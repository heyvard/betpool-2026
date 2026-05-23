import { ApiHandlerOpts } from '../../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../../auth/authHandler'
import { loggEndring } from '../../../../../../data/auditLog'

// /api/v1/leagues/:id/members/:userId
//  PUT    { paid }            — eieren setter betalt-status på et medlem.
//  PUT    { status:'medlem' } — den inviterte (seg selv) takker ja til invitasjonen.
//  DELETE                     — eieren fjerner et medlem, eller medlemmet melder
//                               seg ut / takker nei selv.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    const ligaId = String(req.query.id)
    const userId = String(req.query.userId)

    const liga = (
        await client.query<{ owner_user_id: string }>(`SELECT owner_user_id FROM leagues WHERE id = $1`, [ligaId])
    ).rows[0]
    if (!liga) {
        res.status(404).json({ error: 'liga finnes ikke' })
        return
    }
    const erEier = liga.owner_user_id === user.id
    const gjelderMegSelv = userId === user.id

    const medlemskap = (
        await client.query<{ status: string; paid: boolean }>(
            `SELECT status, paid FROM league_members WHERE league_id = $1 AND user_id = $2`,
            [ligaId, userId],
        )
    ).rows[0]
    if (!medlemskap) {
        res.status(404).json({ error: 'medlemskap finnes ikke' })
        return
    }

    if (req.method === 'PUT') {
        const reqBody = JSON.parse(req.body)

        if ('paid' in reqBody) {
            if (!erEier) {
                res.status(403).end()
                return
            }
            const paid = Boolean(reqBody.paid)
            await client.query(`UPDATE league_members SET paid = $1 WHERE league_id = $2 AND user_id = $3`, [
                paid,
                ligaId,
                userId,
            ])
            await loggEndring(client, {
                actorUserId: user.id,
                entitet: 'league',
                entitetNøkkel: `${ligaId}:${userId}`,
                handling: 'endre_betalt',
                før: { paid: medlemskap.paid },
                etter: { paid },
            })
            res.status(200).json({ ok: true })
            return
        }

        if (reqBody.status === 'medlem') {
            if (!gjelderMegSelv) {
                res.status(403).end()
                return
            }
            if (medlemskap.status === 'medlem') {
                res.status(409).json({ error: 'allerede medlem' })
                return
            }
            await client.query(`UPDATE league_members SET status = 'medlem' WHERE league_id = $1 AND user_id = $2`, [
                ligaId,
                userId,
            ])
            await loggEndring(client, {
                actorUserId: user.id,
                entitet: 'league',
                entitetNøkkel: `${ligaId}:${userId}`,
                handling: 'godta_invitasjon',
                før: { status: medlemskap.status },
                etter: { status: 'medlem' },
            })
            res.status(200).json({ ok: true })
            return
        }

        res.status(400).json({ error: 'ugyldig forespørsel' })
        return
    }

    if (req.method === 'DELETE') {
        // Eieren kan ikke fjerne sitt eget medlemskap — da må hele ligaen slettes.
        if (userId === liga.owner_user_id) {
            res.status(400).json({ error: 'eieren kan ikke fjernes; slett ligaen i stedet' })
            return
        }
        if (!erEier && !gjelderMegSelv) {
            res.status(403).end()
            return
        }
        await client.query(`DELETE FROM league_members WHERE league_id = $1 AND user_id = $2`, [ligaId, userId])
        await loggEndring(client, {
            actorUserId: user.id,
            entitet: 'league',
            entitetNøkkel: `${ligaId}:${userId}`,
            handling: gjelderMegSelv ? 'forlat_liga' : 'fjern_medlem',
            før: { status: medlemskap.status },
            etter: null,
        })
        res.status(200).json({ ok: true })
        return
    }

    res.status(405).end()
}

export default auth(handler)
