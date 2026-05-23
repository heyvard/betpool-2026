import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { loggEndring } from '../../../data/auditLog'
import { parseProsenter } from '../../../data/premier'

// /api/v1/leagues
//  GET  — ligaer der innlogget bruker er medlem eller invitert.
//  POST — opprett en ny privat liga (oppretteren blir eier og medlem).
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (req.method === 'POST') {
        const reqBody = JSON.parse(req.body)
        const name: string = typeof reqBody.name === 'string' ? reqBody.name.trim() : ''
        if (name.length < 1 || name.length > 100) {
            res.status(400).json({ error: 'name må være mellom 1 og 100 tegn' })
            return
        }

        let innsats: number | null = null
        if (reqBody.innsats !== undefined && reqBody.innsats !== null && reqBody.innsats !== '') {
            const n = Number(reqBody.innsats)
            if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
                res.status(400).json({ error: 'innsats må være et heltall mellom 0 og 1 000 000' })
                return
            }
            innsats = n
        }

        const betalingsinfo: string | null =
            typeof reqBody.betalingsinfo === 'string' && reqBody.betalingsinfo.trim() !== ''
                ? reqBody.betalingsinfo.trim()
                : null

        const prosenter = parseProsenter(reqBody)
        if (!prosenter.ok) {
            res.status(400).json({ error: prosenter.error })
            return
        }
        const { premie_forste_prosent, premie_andre_prosent, premie_tredje_prosent } = prosenter.verdier

        const ligaId = (
            await client.query<{ id: string }>(
                `INSERT INTO leagues (name, owner_user_id, innsats, betalingsinfo,
                                     premie_forste_prosent, premie_andre_prosent, premie_tredje_prosent)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [
                    name,
                    user.id,
                    innsats,
                    betalingsinfo,
                    premie_forste_prosent,
                    premie_andre_prosent,
                    premie_tredje_prosent,
                ],
            )
        ).rows[0].id

        await client.query(
            `INSERT INTO league_members (league_id, user_id, status, paid)
             VALUES ($1, $2, 'medlem', false)`,
            [ligaId, user.id],
        )

        await loggEndring(client, {
            actorUserId: user.id,
            entitet: 'league',
            entitetNøkkel: ligaId,
            handling: 'opprett_liga',
            før: null,
            etter: {
                name,
                innsats,
                betalingsinfo,
                premie_forste_prosent,
                premie_andre_prosent,
                premie_tredje_prosent,
            },
        })

        res.status(201).json({ id: ligaId })
        return
    }

    interface Rad {
        id: string
        name: string
        owner_user_id: string
        owner_name: string
        innsats: number | null
        betalingsinfo: string | null
        premie_forste_prosent: number
        premie_andre_prosent: number
        premie_tredje_prosent: number
        my_status: string
        my_paid: boolean
        member_count: string
    }

    const rader = (
        await client.query<Rad>(
            `SELECT l.id,
                    l.name,
                    l.owner_user_id,
                    ou.name AS owner_name,
                    l.innsats,
                    l.betalingsinfo,
                    l.premie_forste_prosent,
                    l.premie_andre_prosent,
                    l.premie_tredje_prosent,
                    lm.status AS my_status,
                    lm.paid AS my_paid,
                    (SELECT COUNT(*) FROM league_members m
                     WHERE m.league_id = l.id AND m.status = 'medlem') AS member_count
             FROM league_members lm
             JOIN leagues l ON l.id = lm.league_id
             JOIN users ou ON ou.id = l.owner_user_id
             WHERE lm.user_id = $1
             ORDER BY l.name`,
            [user.id],
        )
    ).rows

    res.status(200).json(
        rader.map((r) => ({
            id: r.id,
            name: r.name,
            owner_user_id: r.owner_user_id,
            owner_name: r.owner_name,
            innsats: r.innsats,
            betalingsinfo: r.betalingsinfo,
            premie_forste_prosent: r.premie_forste_prosent,
            premie_andre_prosent: r.premie_andre_prosent,
            premie_tredje_prosent: r.premie_tredje_prosent,
            member_count: Number(r.member_count),
            my_status: r.my_status,
            my_paid: r.my_paid,
            is_owner: r.owner_user_id === user.id,
        })),
    )
}

export default auth(handler)
