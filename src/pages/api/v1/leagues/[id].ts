import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { loggEndring } from '../../../../data/auditLog'
import { parseProsenter } from '../../../../data/premier'

// /api/v1/leagues/:id
//  GET    — ligadetalj med medlemsliste (kun medlem/invitert).
//  PUT    — oppdater navn/innsats/betalingsinfo (kun eier).
//  DELETE — slett ligaen (kun eier; medlemmer fjernes av ON DELETE CASCADE).
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    const ligaId = String(req.query.id)

    const liga = (
        await client.query<{
            id: string
            name: string
            owner_user_id: string
            innsats: number | null
            betalingsinfo: string | null
            owner_name: string
            premie_forste_prosent: number
            premie_andre_prosent: number
            premie_tredje_prosent: number
        }>(
            `SELECT l.id, l.name, l.owner_user_id, l.innsats, l.betalingsinfo,
                    l.premie_forste_prosent, l.premie_andre_prosent, l.premie_tredje_prosent,
                    ou.name AS owner_name
             FROM leagues l
             JOIN users ou ON ou.id = l.owner_user_id
             WHERE l.id = $1 AND l.deleted_at IS NULL`,
            [ligaId],
        )
    ).rows[0]

    if (!liga) {
        res.status(404).json({ error: 'liga finnes ikke' })
        return
    }

    const erEier = liga.owner_user_id === user.id

    // Bare medlemmer og inviterte får se en liga.
    const eget = (
        await client.query<{ status: string }>(
            `SELECT status FROM league_members WHERE league_id = $1 AND user_id = $2`,
            [ligaId, user.id],
        )
    ).rows[0]
    if (!eget) {
        res.status(403).end()
        return
    }

    if (req.method === 'PUT') {
        if (!erEier) {
            res.status(403).end()
            return
        }
        const reqBody = JSON.parse(req.body)

        let name = liga.name
        let innsats = liga.innsats
        let betalingsinfo = liga.betalingsinfo

        if ('name' in reqBody) {
            const n = typeof reqBody.name === 'string' ? reqBody.name.trim() : ''
            if (n.length < 1 || n.length > 100) {
                res.status(400).json({ error: 'name må være mellom 1 og 100 tegn' })
                return
            }
            name = n
        }
        if ('innsats' in reqBody) {
            if (reqBody.innsats === null || reqBody.innsats === '') {
                innsats = null
            } else {
                const n = Number(reqBody.innsats)
                if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
                    res.status(400).json({ error: 'innsats må være et heltall mellom 0 og 1 000 000' })
                    return
                }
                innsats = n
            }
        }
        if ('betalingsinfo' in reqBody) {
            betalingsinfo =
                typeof reqBody.betalingsinfo === 'string' && reqBody.betalingsinfo.trim() !== ''
                    ? reqBody.betalingsinfo.trim()
                    : null
        }

        const prosenter = parseProsenter(reqBody, {
            premie_forste_prosent: liga.premie_forste_prosent,
            premie_andre_prosent: liga.premie_andre_prosent,
            premie_tredje_prosent: liga.premie_tredje_prosent,
        })
        if (!prosenter.ok) {
            res.status(400).json({ error: prosenter.error })
            return
        }

        await client.query(
            `UPDATE leagues
             SET name = $1, innsats = $2, betalingsinfo = $3,
                 premie_forste_prosent = $4, premie_andre_prosent = $5, premie_tredje_prosent = $6
             WHERE id = $7`,
            [
                name,
                innsats,
                betalingsinfo,
                prosenter.verdier.premie_forste_prosent,
                prosenter.verdier.premie_andre_prosent,
                prosenter.verdier.premie_tredje_prosent,
                ligaId,
            ],
        )

        await loggEndring(client, {
            actorUserId: user.id,
            entitet: 'league',
            entitetNøkkel: ligaId,
            handling: 'endre_liga',
            før: {
                name: liga.name,
                innsats: liga.innsats,
                betalingsinfo: liga.betalingsinfo,
                premie_forste_prosent: liga.premie_forste_prosent,
                premie_andre_prosent: liga.premie_andre_prosent,
                premie_tredje_prosent: liga.premie_tredje_prosent,
            },
            etter: { name, innsats, betalingsinfo, ...prosenter.verdier },
        })

        res.status(200).json({ ok: true })
        return
    }

    if (req.method === 'DELETE') {
        if (!erEier) {
            res.status(403).end()
            return
        }
        await client.query(`UPDATE leagues SET deleted_at = NOW() WHERE id = $1`, [ligaId])
        await loggEndring(client, {
            actorUserId: user.id,
            entitet: 'league',
            entitetNøkkel: ligaId,
            handling: 'slett_liga',
            før: { name: liga.name },
            etter: null,
        })
        res.status(200).json({ ok: true })
        return
    }

    const members = (
        await client.query<{
            user_id: string
            name: string
            picture: string | null
            status: string
            paid: boolean
        }>(
            `SELECT lm.user_id, COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name, u.picture, lm.status, lm.paid
             FROM league_members lm
             JOIN users u ON u.id = lm.user_id
             WHERE lm.league_id = $1
             ORDER BY COALESCE(NULLIF(u.kallenavn, ''), u.name)`,
            [ligaId],
        )
    ).rows

    res.status(200).json({
        id: liga.id,
        name: liga.name,
        owner_user_id: liga.owner_user_id,
        owner_name: liga.owner_name,
        innsats: liga.innsats,
        betalingsinfo: liga.betalingsinfo,
        premie_forste_prosent: liga.premie_forste_prosent,
        premie_andre_prosent: liga.premie_andre_prosent,
        premie_tredje_prosent: liga.premie_tredje_prosent,
        is_owner: erEier,
        members,
    })
}

export default auth(handler)
