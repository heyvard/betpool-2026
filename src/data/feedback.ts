import { PoolClient } from 'pg'

// Datatilgang for tilbakemeldinger (feedback-tabellen). Tynne wrappere over
// client.query — samme stil som src/data/matches.ts.

export interface TilbakemeldingRad {
    id: string
    user_id: string
    name: string
    picture: string | null
    message: string
    behandlet_at: string | null
    created_at: string
}

// Lagrer en ny tilbakemelding fra en bruker.
export async function lagreTilbakemelding(client: PoolClient, userId: string, message: string): Promise<void> {
    await client.query('INSERT INTO feedback (user_id, message) VALUES ($1, $2)', [userId, message])
}

// Henter alle tilbakemeldinger med avsenderens visningsnavn — nyeste først.
// Samme navne-fallback (kallenavn → name) som chat-GET.
export async function hentTilbakemeldinger(client: PoolClient): Promise<TilbakemeldingRad[]> {
    return (
        await client.query<TilbakemeldingRad>(
            `SELECT f.id,
                    f.user_id,
                    COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name,
                    u.picture,
                    f.message,
                    f.behandlet_at,
                    f.created_at
             FROM feedback f
             JOIN users u ON u.id = f.user_id
             ORDER BY f.created_at DESC`,
        )
    ).rows
}

// Markerer en tilbakemelding som behandlet (eller nullstiller statusen).
export async function settBehandlet(
    client: PoolClient,
    id: string,
    behandletAv: string,
    behandlet: boolean,
): Promise<void> {
    if (behandlet) {
        await client.query(`UPDATE feedback SET behandlet_at = now(), behandlet_av = $2 WHERE id = $1`, [
            id,
            behandletAv,
        ])
    } else {
        await client.query(`UPDATE feedback SET behandlet_at = NULL, behandlet_av = NULL WHERE id = $1`, [id])
    }
}
