import { PoolClient } from 'pg'

import { Spiller } from '../types/types'

// Spillerne bor i `players`-tabellen (hentet fra football-data av synken, se
// src/server/syncPlayers.ts). Lesing skjer server-side med en PoolClient; klienten
// henter via /api/v1/admin/players.

interface SpillerRad {
    id: number
    name: string
    first_name: string | null
    last_name: string | null
    position: string | null
    date_of_birth: Date | null
    nationality: string | null
    shirt_number: number | null
    team_tla: string
    team_id: number | null
    team_name: string | null
}

function radTilSpiller(r: SpillerRad): Spiller {
    return {
        id: r.id,
        name: r.name,
        first_name: r.first_name,
        last_name: r.last_name,
        position: r.position,
        date_of_birth: r.date_of_birth ? r.date_of_birth.toISOString().slice(0, 10) : null,
        nationality: r.nationality,
        shirt_number: r.shirt_number,
        team_tla: r.team_tla,
        team_id: r.team_id,
        team_name: r.team_name,
    }
}

export async function hentSpillere(client: PoolClient): Promise<Spiller[]> {
    const rows = (
        await client.query<SpillerRad>(
            `SELECT id, name, first_name, last_name, position, date_of_birth, nationality,
                    shirt_number, team_tla, team_id, team_name
             FROM players
             ORDER BY team_tla ASC, shirt_number ASC NULLS LAST, name ASC`,
        )
    ).rows
    return rows.map(radTilSpiller)
}
