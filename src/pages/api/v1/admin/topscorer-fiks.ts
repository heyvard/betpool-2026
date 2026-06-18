import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { loggEndring } from '../../../../data/auditLog'
import { ToppscorerFiksBruker } from '../../../../types/types'

// Verktøy for å konvertere brukernes fritekst-toppscorer til en strukturert
// kobling mot `players`. Kun superadmin. GET lister alle brukere med fritekst +
// nåværende kobling; PUT setter (eller nullstiller) topscorer_player_id for én
// bruker. Den gamle fritekst-kolonnen røres aldri her — den er kilden vi tolker.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (!user.superadmin) {
        res.status(403).end()
        return
    }

    if (req.method === 'PUT') {
        const reqBody = JSON.parse(req.body)
        const målBrukerId: unknown = reqBody.userId
        // null/undefined betyr «nullstill koblingen». Ellers må det være et tall.
        const råPlayerId: unknown = reqBody.playerId
        const playerId = råPlayerId === null || råPlayerId === undefined ? null : Number(råPlayerId)

        if (typeof målBrukerId !== 'string' || !målBrukerId) {
            res.status(400).json({ error: 'userId mangler' })
            return
        }
        if (playerId !== null && !Number.isInteger(playerId)) {
            res.status(400).json({ error: 'playerId må være et heltall eller null' })
            return
        }

        if (playerId !== null) {
            const finnes = await client.query(`SELECT 1 FROM players WHERE id = $1`, [playerId])
            if (finnes.rowCount === 0) {
                res.status(400).json({ error: 'Ukjent spiller' })
                return
            }
        }

        const førRad = (
            await client.query<{ topscorer_player_id: number | null }>(
                `SELECT topscorer_player_id FROM users WHERE id = $1`,
                [målBrukerId],
            )
        ).rows[0]

        if (!førRad) {
            res.status(404).json({ error: 'Ukjent bruker' })
            return
        }

        await client.query(`UPDATE users SET topscorer_player_id = $1 WHERE id = $2`, [playerId, målBrukerId])

        if (førRad.topscorer_player_id !== playerId) {
            await loggEndring(client, {
                actorUserId: user.id,
                entitet: 'user',
                entitetNøkkel: String(målBrukerId),
                handling: 'fiks_toppscorer',
                før: { topscorer_player_id: førRad.topscorer_player_id },
                etter: { topscorer_player_id: playerId },
            })
        }

        res.status(200).json({ ok: true })
        return
    }

    const brukere = (
        await client.query<ToppscorerFiksBruker>(
            `
                SELECT u.id,
                       COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name,
                       u.topscorer,
                       u.topscorer_player_id,
                       p.name AS player_name,
                       p.team_tla AS player_team_tla
                FROM users u
                LEFT JOIN players p ON p.id = u.topscorer_player_id
                WHERE u.active = true
                ORDER BY name ASC`,
        )
    ).rows
    res.status(200).json(brukere)
}

export default auth(handler)
