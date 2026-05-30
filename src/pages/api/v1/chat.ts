import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, req, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }
    if (req.method == 'POST') {
        const reqBody = JSON.parse(req.body)

        await client.query('INSERT INTO chat (message, user_id) VALUES ($1, $2)', [reqBody.message, user.id])
        res.status(201).json({ ok: ':)' })
        return
    }

    const chat = (
        await client.query(`
        SELECT u.id userid,
               COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name,
               u.picture,
               c.*
        FROM chat c,
             users u
        WHERE c.user_id = u.id
        ORDER BY c.created_at asc
        `)
    ).rows

    res.json(chat)
}
export default auth(handler)
