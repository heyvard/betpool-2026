import { PoolClient } from 'pg'

// Den faktiske turneringsfasiten — motstykke til brukernes egne tips
// (users.winner/topscorer_player_id). Satt av superadmin via
// /api/v1/admin/tournament-result. Lesing skjer server-side; brukes til å
// berike AllBets slik at calculateAllBetsExtended kan beregne winner-/
// toppscorer-bonus uten å importere en DB-modul (den kjører også klientsidig).

export interface TurneringsFasit {
    winnerTeam: string
    topscorerPlayerIds: number[]
}

export async function hentTurneringsFasit(client: PoolClient): Promise<TurneringsFasit> {
    const [vinnerRad, spillerRader] = await Promise.all([
        client.query<{ winner_team_tla: string | null }>(
            `SELECT winner_team_tla FROM tournament_result WHERE id = 'current'`,
        ),
        client.query<{ player_id: number }>(`SELECT player_id FROM tournament_topscorers ORDER BY player_id`),
    ])
    return {
        winnerTeam: vinnerRad.rows[0]?.winner_team_tla ?? '',
        topscorerPlayerIds: spillerRader.rows.map((r) => r.player_id),
    }
}
