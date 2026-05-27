import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { loggEndring } from '../../../../../data/auditLog'

// /api/v1/leagues/:id/members
//  POST { user_id } — eieren inviterer en bruker til ligaen (status 'invitert').
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (req.method !== 'POST') {
        res.status(405).end()
        return
    }

    const ligaId = String(req.query.id)

    const liga = (
        await client.query<{ owner_user_id: string }>(
            `SELECT owner_user_id FROM leagues WHERE id = $1 AND deleted_at IS NULL`,
            [ligaId],
        )
    ).rows[0]
    if (!liga) {
        res.status(404).json({ error: 'liga finnes ikke' })
        return
    }
    if (liga.owner_user_id !== user.id) {
        res.status(403).end()
        return
    }

    const reqBody = JSON.parse(req.body)
    const userId: string = typeof reqBody.user_id === 'string' ? reqBody.user_id : ''
    if (!userId) {
        res.status(400).json({ error: 'user_id mangler' })
        return
    }

    const målbruker = (
        await client.query<{ id: string; active: boolean }>(`SELECT id, active FROM users WHERE id = $1`, [userId])
    ).rows[0]
    if (!målbruker || !målbruker.active) {
        res.status(404).json({ error: 'bruker finnes ikke' })
        return
    }

    const finnes = (
        await client.query(`SELECT 1 FROM league_members WHERE league_id = $1 AND user_id = $2`, [ligaId, userId])
    ).rowCount
    if (finnes) {
        res.status(409).json({ error: 'brukeren er allerede medlem eller invitert' })
        return
    }

    await client.query(
        `INSERT INTO league_members (league_id, user_id, status, paid)
         VALUES ($1, $2, 'invitert', false)`,
        [ligaId, userId],
    )

    await loggEndring(client, {
        actorUserId: user.id,
        entitet: 'league',
        entitetNøkkel: `${ligaId}:${userId}`,
        handling: 'inviter_medlem',
        før: null,
        etter: { status: 'invitert' },
    })

    res.status(201).json({ ok: true })
}

export default auth(handler)
