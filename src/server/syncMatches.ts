import { PoolClient } from 'pg'

import { FootballDataMatch, transformerKamp } from '../data/footballDataMatch'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const SEASON = '2026'

export interface SyncResultat {
    hentet: number
    oppdatert: number
}

interface FootballDataResponse {
    matches: FootballDataMatch[]
}

// Henter kampoppsettet fra football-data.org og upserter til `matches`-tabellen.
// Oppdaterer kun rader der noe faktisk er endret (tid, lag, runde, gruppe, stage),
// så `synced_at` reflekterer reelle endringer. Rører ikke `match_scores` —
// resultater og team-override er manuell sannhet.
export async function syncMatches(client: PoolClient): Promise<SyncResultat> {
    console.log('[sync-matches] starter')
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
