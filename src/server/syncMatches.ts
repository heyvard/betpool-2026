import { PoolClient } from 'pg'

import { FootballDataMatch, transformerKamp } from '../data/footballDataMatch'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const SEASON = '2026'

export interface DryRunEndring {
    match_num: number
    home_team: string | null
    away_team: string | null
    ny: boolean
    felt: string[]
    fra: Partial<Record<string, string | number | null>>
    til: Partial<Record<string, string | number | null>>
}

export interface SyncResultat {
    hentet: number
    oppdatert: number
    dryRun?: true
    endringer?: DryRunEndring[]
}

interface FootballDataResponse {
    matches: FootballDataMatch[]
}

// Henter kampoppsettet fra football-data.org og upserter til `matches`-tabellen.
// Oppdaterer kun rader der noe faktisk er endret (tid, lag, runde, gruppe, stage),
// så `synced_at` reflekterer reelle endringer. Rører ikke `match_scores` —
// resultater og team-override er manuell sannhet.
// Med dryRun=true gjøres ingen DB-skriving; returnerer hva som ville blitt endret.
export async function syncMatches(client: PoolClient, dryRun = false): Promise<SyncResultat> {
    console.log(`[sync-matches] starter${dryRun ? ' (dry run)' : ''}`)
    const token = process.env.FOOTBALL_DATA_TOKEN
    if (!token) {
        throw new Error('Mangler FOOTBALL_DATA_TOKEN')
    }

    const url = `${BASE_URL}/competitions/${COMPETITION}/matches?season=${SEASON}`
    console.log(`[sync-matches] henter kampoppsett fra football-data.org (${COMPETITION} ${SEASON})`)
    const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`football-data.org svarte ${res.status} ${res.statusText}: ${body}`)
    }

    const body = (await res.json()) as FootballDataResponse
    const kamper = (body.matches ?? []).map(transformerKamp)
    console.log(`[sync-matches] mottok ${kamper.length} kamper fra API`)

    if (dryRun) {
        const { rows: eksisterende } = await client.query<{
            match_num: number
            round: number
            home_team: string | null
            away_team: string | null
            game_start: Date
            group: string | null
            stage: string
            status: string
        }>('SELECT match_num, round, home_team, away_team, game_start, "group", stage, status FROM matches')

        const eksisterendeMap = new Map(eksisterende.map((r) => [r.match_num, r]))
        const endringer: DryRunEndring[] = []

        for (const k of kamper) {
            const home = k.home_team || null
            const away = k.away_team || null
            const group = k.group ?? null
            const stage = stageFor(k.round)
            const existing = eksisterendeMap.get(k.match_num)

            if (!existing) {
                endringer.push({
                    match_num: k.match_num,
                    home_team: home,
                    away_team: away,
                    ny: true,
                    felt: ['round', 'home_team', 'away_team', 'game_start', 'group', 'stage', 'status'],
                    fra: {},
                    til: {
                        round: k.round,
                        home_team: home,
                        away_team: away,
                        game_start: k.game_start,
                        group,
                        stage,
                        status: k.status,
                    },
                })
                continue
            }

            const felt: string[] = []
            const fra: DryRunEndring['fra'] = {}
            const til: DryRunEndring['til'] = {}

            if (existing.round !== k.round) {
                felt.push('round')
                fra.round = existing.round
                til.round = k.round
            }
            if ((existing.home_team ?? null) !== home) {
                felt.push('home_team')
                fra.home_team = existing.home_team ?? null
                til.home_team = home
            }
            if ((existing.away_team ?? null) !== away) {
                felt.push('away_team')
                fra.away_team = existing.away_team ?? null
                til.away_team = away
            }
            if ((existing.group ?? null) !== group) {
                felt.push('group')
                fra.group = existing.group ?? null
                til.group = group
            }
            if (existing.stage !== stage) {
                felt.push('stage')
                fra.stage = existing.stage
                til.stage = stage
            }
            if (existing.status !== k.status) {
                felt.push('status')
                fra.status = existing.status
                til.status = k.status
            }
            if (new Date(existing.game_start).getTime() !== new Date(k.game_start).getTime()) {
                felt.push('game_start')
                fra.game_start = new Date(existing.game_start).toISOString()
                til.game_start = new Date(k.game_start).toISOString()
            }

            if (felt.length > 0) {
                endringer.push({ match_num: k.match_num, home_team: home, away_team: away, ny: false, felt, fra, til })
            }
        }

        const resultat: SyncResultat = { hentet: kamper.length, oppdatert: endringer.length, dryRun: true, endringer }
        console.log(`[sync-matches] dry run ferdig — ${endringer.length} endringer funnet`)
        return resultat
    }

    let oppdatert = 0
    for (const k of kamper) {
        const home = k.home_team || null
        const away = k.away_team || null
        const group = k.group ?? null
        const result = await client.query(
            `INSERT INTO matches (match_num, round, home_team, away_team, game_start, "group", stage, status, synced_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
             ON CONFLICT (match_num) DO UPDATE SET
                 round = EXCLUDED.round,
                 home_team = EXCLUDED.home_team,
                 away_team = EXCLUDED.away_team,
                 game_start = EXCLUDED.game_start,
                 "group" = EXCLUDED."group",
                 stage = EXCLUDED.stage,
                 status = EXCLUDED.status,
                 synced_at = now()
             WHERE
                 matches.round IS DISTINCT FROM EXCLUDED.round
                 OR matches.home_team IS DISTINCT FROM EXCLUDED.home_team
                 OR matches.away_team IS DISTINCT FROM EXCLUDED.away_team
                 OR matches.game_start IS DISTINCT FROM EXCLUDED.game_start
                 OR matches."group" IS DISTINCT FROM EXCLUDED."group"
                 OR matches.stage IS DISTINCT FROM EXCLUDED.stage
                 OR matches.status IS DISTINCT FROM EXCLUDED.status`,
            [k.match_num, k.round, home, away, k.game_start, group, stageFor(k.round), k.status],
        )
        if (result.rowCount && result.rowCount > 0) {
            oppdatert++
            console.log(
                `[sync-matches] oppdaterte kamp ${k.match_num}: ${home ?? '?'} vs ${away ?? '?'} (runde ${k.round}, ${k.status})`,
            )
        }
    }

    const resultat = { hentet: kamper.length, oppdatert }
    console.log('[sync-matches] ferdig —', resultat)
    return resultat
}

// stage lagres for referanse; utled fra runde slik at den holdes konsistent med
// transformerKamp uten å lese rådata på nytt.
function stageFor(round: number): string {
    switch (round) {
        case 4:
            return 'LAST_32'
        case 5:
            return 'LAST_16'
        case 6:
            return 'QUARTER_FINALS'
        case 7:
            return 'SEMI_FINALS'
        case 8:
            return 'THIRD_PLACE'
        case 9:
            return 'FINAL'
        default:
            return 'GROUP_STAGE'
    }
}
