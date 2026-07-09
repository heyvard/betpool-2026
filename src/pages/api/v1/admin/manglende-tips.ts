import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { loggEndring } from '../../../../data/auditLog'
import { landNorsk } from '../../../../data/landNorsk'
import { ManglendeTipsBruker } from '../../../../types/types'

// Lar superadmin sette vinner-/toppscorer-tips for brukere som ikke har tippet
// selv (fristen er ute). Setter alltid samtidig winner_endret/topscorer_endret
// = true, slik at kategorien telles med halvt poeng i scoringen — akkurat som
// når en bruker selv bytter tips i endrevinduet (calculateAllBetsExtended.ts).
// Kun for brukere som mangler verdien; bruk /toppscorer-fiks for å korrigere en
// allerede satt toppscorer-kobling.
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

        if (typeof målBrukerId !== 'string' || !målBrukerId) {
            res.status(400).json({ error: 'userId mangler' })
            return
        }

        const harWinner = typeof reqBody.winner === 'string' && reqBody.winner.length > 0
        const harTopscorer = reqBody.topscorerPlayerId !== undefined
        if (harWinner === harTopscorer) {
            res.status(400).json({ error: 'Send enten winner eller topscorerPlayerId' })
            return
        }

        const førRad = (
            await client.query<{ winner: string; topscorer_player_id: number | null }>(
                `SELECT winner, topscorer_player_id FROM users WHERE id = $1`,
                [målBrukerId],
            )
        ).rows[0]

        if (!førRad) {
            res.status(404).json({ error: 'Ukjent bruker' })
            return
        }

        if (harWinner) {
            const winner: string = reqBody.winner
            if (!(winner in landNorsk)) {
                res.status(400).json({ error: 'Ukjent landskode' })
                return
            }
            if (førRad.winner !== '') {
                res.status(400).json({ error: 'Brukeren har allerede satt vinner-tips' })
                return
            }

            await client.query(`UPDATE users SET winner = $1, winner_endret = true WHERE id = $2`, [
                winner,
                målBrukerId,
            ])
            await loggEndring(client, {
                actorUserId: user.id,
                entitet: 'user',
                entitetNøkkel: String(målBrukerId),
                handling: 'sett_vinner_admin',
                før: { winner: førRad.winner, winner_endret: false },
                etter: { winner, winner_endret: true },
            })
        } else {
            const råPlayerId: unknown = reqBody.topscorerPlayerId
            const playerId = Number(råPlayerId)
            if (!Number.isInteger(playerId)) {
                res.status(400).json({ error: 'topscorerPlayerId må være et heltall' })
                return
            }
            if (førRad.topscorer_player_id != null) {
                res.status(400).json({ error: 'Brukeren har allerede satt toppscorer-tips' })
                return
            }

            const finnes = await client.query(`SELECT 1 FROM players WHERE id = $1`, [playerId])
            if (finnes.rowCount === 0) {
                res.status(400).json({ error: 'Ukjent spiller' })
                return
            }

            await client.query(`UPDATE users SET topscorer_player_id = $1, topscorer_endret = true WHERE id = $2`, [
                playerId,
                målBrukerId,
            ])
            await loggEndring(client, {
                actorUserId: user.id,
                entitet: 'user',
                entitetNøkkel: String(målBrukerId),
                handling: 'sett_topscorer_admin',
                før: { topscorer_player_id: førRad.topscorer_player_id, topscorer_endret: false },
                etter: { topscorer_player_id: playerId, topscorer_endret: true },
            })
        }

        res.status(200).json({ ok: true })
        return
    }

    const brukere = (
        await client.query<ManglendeTipsBruker>(
            `
                SELECT u.id,
                       COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name,
                       u.winner,
                       u.winner_endret,
                       u.topscorer_player_id,
                       u.topscorer_endret,
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
