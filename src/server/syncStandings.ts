import { PoolClient } from 'pg'

import { gruppeTilTekst, normaliserTla } from '../data/footballDataMatch'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const SEASON = '2026'

export interface StandingsSyncResultat {
    grupper: number
    rader: number
}

// Rå standings slik football-data.org v4 leverer dem (feltene vi bruker).
interface FootballDataTableRow {
    position: number
    team: { tla: string | null }
    playedGames: number
    won: number
    draw: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    goalDifference: number
    points: number
}

interface FootballDataStanding {
    stage: string
    type: string // TOTAL | HOME | AWAY
    group: string | null // "GROUP_A"
    table: FootballDataTableRow[]
}

interface FootballDataStandingsResponse {
    standings: FootballDataStanding[]
}

// Henter gruppetabellene fra football-data.org og upserter til `group_standings`.
// Bruker kun `type === 'TOTAL'` (samlet tabell, ikke hjemme/borte). Endepunktet
// kan returnere tomme tabeller før første kamp — da skrives ingen rader.
export async function syncStandings(client: PoolClient): Promise<StandingsSyncResultat> {
    console.log('[sync-standings] starter')
    const token = process.env.FOOTBALL_DATA_TOKEN
    if (!token) {
        throw new Error('Mangler FOOTBALL_DATA_TOKEN')
    }

    const url = `${BASE_URL}/competitions/${COMPETITION}/standings?season=${SEASON}`
    console.log(`[sync-standings] henter gruppetabeller fra football-data.org (${COMPETITION} ${SEASON})`)
    const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`football-data.org svarte ${res.status} ${res.statusText}: ${body}`)
    }

    const body = (await res.json()) as FootballDataStandingsResponse
    const grupper = (body.standings ?? []).filter((s) => s.type === 'TOTAL' && s.group)
    console.log(`[sync-standings] mottok ${grupper.length} grupper fra API`)

    let rader = 0
    for (const gruppe of grupper) {
        const group = gruppeTilTekst(gruppe.group)
        if (!group) continue
        for (const rad of gruppe.table) {
            const tla = normaliserTla(rad.team?.tla ?? null)
            if (!tla) continue
            await client.query(
                `INSERT INTO group_standings
                     ("group", team_tla, position, played, won, draw, lost,
                      goals_for, goals_against, goal_difference, points, synced_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
                 ON CONFLICT ("group", team_tla) DO UPDATE SET
                     position = EXCLUDED.position,
                     played = EXCLUDED.played,
                     won = EXCLUDED.won,
                     draw = EXCLUDED.draw,
                     lost = EXCLUDED.lost,
                     goals_for = EXCLUDED.goals_for,
                     goals_against = EXCLUDED.goals_against,
                     goal_difference = EXCLUDED.goal_difference,
                     points = EXCLUDED.points,
                     synced_at = now()`,
                [
                    group,
                    tla,
                    rad.position,
                    rad.playedGames,
                    rad.won,
                    rad.draw,
                    rad.lost,
                    rad.goalsFor,
                    rad.goalsAgainst,
                    rad.goalDifference,
                    rad.points,
                ],
            )
            rader++
        }
    }

    const resultat = { grupper: grupper.length, rader }
    console.log('[sync-standings] ferdig —', resultat)
    return resultat
}
