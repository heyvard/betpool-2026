import { PoolClient } from 'pg'

import { Match } from '../types/types'

// Kampene bor i `matches`-tabellen (seedet fra football-data og holdt oppdatert
// av sync-cronen, se src/server/syncMatches.ts). Lesing skjer server-side med en
// PoolClient; klienten henter kamper via /api/v1/matches.

interface MatchRow {
    match_num: number
    round: number
    home_team: string | null
    away_team: string | null
    game_start: Date
    group: string | null
}

function radTilMatch(r: MatchRow): Match {
    return {
        match_num: r.match_num,
        round: r.round,
        home_team: r.home_team ?? '',
        away_team: r.away_team ?? '',
        game_start: r.game_start.toISOString(),
        home_score: null,
        away_score: null,
        group: r.group ?? undefined,
    }
}

export async function hentKamper(client: PoolClient): Promise<Match[]> {
    const rows = (
        await client.query<MatchRow>(
            `SELECT match_num, round, home_team, away_team, game_start, "group"
             FROM matches
             ORDER BY game_start ASC`,
        )
    ).rows
    return rows.map(radTilMatch)
}

export async function hentKamp(client: PoolClient, num: number): Promise<Match | undefined> {
    const rows = (
        await client.query<MatchRow>(
            `SELECT match_num, round, home_team, away_team, game_start, "group"
             FROM matches
             WHERE match_num = $1`,
            [num],
        )
    ).rows
    return rows.length ? radTilMatch(rows[0]) : undefined
}

export async function hentKampnumreIRunde(client: PoolClient, round: number): Promise<number[]> {
    const rows = (await client.query<{ match_num: number }>(`SELECT match_num FROM matches WHERE round = $1`, [round]))
        .rows
    return rows.map((r) => r.match_num)
}

// Joker finnes til og med åttendedelsfinalene (Round of 16 = runde 5). Fra
// kvartfinalen og utover er det ikke joker.
export function kanHaJoker(round: number): boolean {
    return round >= 1 && round <= 5
}

// Kamper der Norge spiller teller dobbelt — alle får doblet kamppoengene sine.
// Lag identifiseres med tre-bokstavskoden (tla).
export function erNorgeKamp(homeTeam: string, awayTeam: string): boolean {
    return [homeTeam, awayTeam].some((t) => t.trim().toUpperCase() === 'NOR')
}
