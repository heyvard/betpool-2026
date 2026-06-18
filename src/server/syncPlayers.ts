import { PoolClient } from 'pg'

import { normaliserTla } from '../data/footballDataMatch'

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const SEASON = '2026'

export interface SyncPlayersResultat {
    hentet: number // antall spillere mottatt fra API-et
    oppdatert: number // antall rader faktisk endret/innsatt
    lag: number // antall lag i svaret
}

// Rå spiller slik football-data.org v4 leverer den i en lag-squad (feltene vi bruker).
interface FootballDataPlayer {
    id: number
    name: string
    firstName: string | null
    lastName: string | null
    position: string | null
    dateOfBirth: string | null
    nationality: string | null
    shirtNumber: number | null
}

interface FootballDataTeam {
    id: number
    name: string | null
    tla: string | null
    squad: FootballDataPlayer[] | null
}

interface FootballDataTeamsResponse {
    teams: FootballDataTeam[]
}

interface SpillerRad {
    id: number
    name: string
    first_name: string | null
    last_name: string | null
    position: string | null
    date_of_birth: string | null
    nationality: string | null
    shirt_number: number | null
    team_tla: string
    team_id: number | null
    team_name: string | null
}

// Henter alle truppene fra football-data.org og upserter til `players`-tabellen.
// Ett API-kall (/competitions/WC/teams) gir alle lagene med squad, så vi holder oss
// godt innenfor free tier sin rate-limit (10 kall/min) og Vercel-timeout.
// Oppdaterer kun rader der noe faktisk er endret, så `synced_at` reflekterer reelle
// endringer. Følger samme mønster som src/server/syncMatches.ts.
export async function syncPlayers(client: PoolClient): Promise<SyncPlayersResultat> {
    console.log('[sync-players] starter')

    const token = process.env.FOOTBALL_DATA_TOKEN
    if (!token) {
        throw new Error('Mangler FOOTBALL_DATA_TOKEN')
    }

    const url = `${BASE_URL}/competitions/${COMPETITION}/teams?season=${SEASON}`
    console.log(`[sync-players] henter trupper fra football-data.org (${COMPETITION} ${SEASON})`)
    const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`football-data.org svarte ${res.status} ${res.statusText}: ${body}`)
    }

    const body = (await res.json()) as FootballDataTeamsResponse
    const lag = body.teams ?? []

    const rader: SpillerRad[] = []
    for (const team of lag) {
        const tla = normaliserTla(team.tla)
        if (!tla) continue
        for (const spiller of team.squad ?? []) {
            rader.push({
                id: spiller.id,
                name: spiller.name,
                first_name: spiller.firstName ?? null,
                last_name: spiller.lastName ?? null,
                position: spiller.position ?? null,
                date_of_birth: spiller.dateOfBirth ?? null,
                nationality: spiller.nationality ?? null,
                shirt_number: spiller.shirtNumber ?? null,
                team_tla: tla,
                team_id: team.id ?? null,
                team_name: team.name ?? null,
            })
        }
    }
    console.log(`[sync-players] mottok ${lag.length} lag og ${rader.length} spillere fra API`)

    let oppdatert = 0
    for (const r of rader) {
        const result = await client.query(
            `INSERT INTO players
                 (id, name, first_name, last_name, position, date_of_birth, nationality, shirt_number, team_tla, team_id, team_name, synced_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 first_name = EXCLUDED.first_name,
                 last_name = EXCLUDED.last_name,
                 position = EXCLUDED.position,
                 date_of_birth = EXCLUDED.date_of_birth,
                 nationality = EXCLUDED.nationality,
                 shirt_number = EXCLUDED.shirt_number,
                 team_tla = EXCLUDED.team_tla,
                 team_id = EXCLUDED.team_id,
                 team_name = EXCLUDED.team_name,
                 synced_at = now()
             WHERE
                 players.name IS DISTINCT FROM EXCLUDED.name
                 OR players.first_name IS DISTINCT FROM EXCLUDED.first_name
                 OR players.last_name IS DISTINCT FROM EXCLUDED.last_name
                 OR players.position IS DISTINCT FROM EXCLUDED.position
                 OR players.date_of_birth IS DISTINCT FROM EXCLUDED.date_of_birth
                 OR players.nationality IS DISTINCT FROM EXCLUDED.nationality
                 OR players.shirt_number IS DISTINCT FROM EXCLUDED.shirt_number
                 OR players.team_tla IS DISTINCT FROM EXCLUDED.team_tla
                 OR players.team_id IS DISTINCT FROM EXCLUDED.team_id
                 OR players.team_name IS DISTINCT FROM EXCLUDED.team_name`,
            [
                r.id,
                r.name,
                r.first_name,
                r.last_name,
                r.position,
                r.date_of_birth,
                r.nationality,
                r.shirt_number,
                r.team_tla,
                r.team_id,
                r.team_name,
            ],
        )
        if (result.rowCount && result.rowCount > 0) {
            oppdatert++
        }
    }

    const resultat: SyncPlayersResultat = { hentet: rader.length, oppdatert, lag: lag.length }
    console.log('[sync-players] ferdig —', resultat)
    return resultat
}
