import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { loggEndring } from '../../../../../data/auditLog'

// /api/v1/leagues/join/:token — token-basert «bli med»-flyt for delbare lenker.
//  GET  — lett forhåndsvisning av ligaen (uten medlemskapssjekk; alle innloggede
//         med lenken får se den).
//  POST — meld innlogget bruker på som medlem (idempotent).
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).end()
        return
    }

    const token = String(req.query.token)

    const liga = (
        await client.query<{
            id: string
            name: string
            owner_name: string
            innsats: number | null
            betalingsinfo: string | null
        }>(
            `SELECT l.id, l.name, l.innsats, l.betalingsinfo,
                    COALESCE(NULLIF(ou.kallenavn, ''), ou.name) AS owner_name
             FROM leagues l
             JOIN users ou ON ou.id = l.owner_user_id
             WHERE l.invite_token = $1 AND l.deleted_at IS NULL`,
            [token],
        )
    ).rows[0]
    if (!liga) {
        res.status(404).json({ error: 'invitasjonslenken er ugyldig eller utløpt' })
        return
    }

    const eget = (
        await client.query<{ status: string }>(
            `SELECT status FROM league_members WHERE league_id = $1 AND user_id = $2`,
            [liga.id, user.id],
        )
    ).rows[0]

    if (req.method === 'POST') {
        if (!eget) {
            await client.query(
                `INSERT INTO league_members (league_id, user_id, status, paid)
                 VALUES ($1, $2, 'medlem', false)
                 ON CONFLICT (league_id, user_id) DO NOTHING`,
                [liga.id, user.id],
            )
            await loggEndring(client, {
                actorUserId: user.id,
                entitet: 'league',
                entitetNøkkel: `${liga.id}:${user.id}`,
                handling: 'bli_med_lenke',
                før: null,
                etter: { status: 'medlem' },
            })
        } else if (eget.status === 'invitert') {
            // Hadde en ventende invitasjon fra før — godta den ved å bli med via lenken.
            await client.query(`UPDATE league_members SET status = 'medlem' WHERE league_id = $1 AND user_id = $2`, [
                liga.id,
                user.id,
            ])
            await loggEndring(client, {
                actorUserId: user.id,
                entitet: 'league',
                entitetNøkkel: `${liga.id}:${user.id}`,
                handling: 'bli_med_lenke',
                før: { status: 'invitert' },
                etter: { status: 'medlem' },
            })
        }
        res.status(200).json({ id: liga.id })
        return
    }

    const antall = Number(
        (
            await client.query<{ count: string }>(
                `SELECT COUNT(*) AS count FROM league_members WHERE league_id = $1 AND status = 'medlem'`,
                [liga.id],
            )
        ).rows[0].count,
    )

    res.status(200).json({
        id: liga.id,
        name: liga.name,
        owner_name: liga.owner_name,
        member_count: antall,
        innsats: liga.innsats,
        betalingsinfo: liga.betalingsinfo,
        already_member: eget?.status === 'medlem',
    })
}

export default auth(handler)
