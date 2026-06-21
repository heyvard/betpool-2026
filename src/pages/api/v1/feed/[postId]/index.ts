import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'

// DELETE /api/v1/feed/:postId — slett en enkelt feed-post. Kun superadmin.
// Reaksjoner og kommentarer (med egne reaksjoner) fjernes via ON DELETE CASCADE.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }
    if (!user.superadmin) {
        res.status(403).end()
        return
    }
    if (req.method !== 'DELETE') {
        res.status(405).end()
        return
    }

    const postId = req.query.postId as string
    const slettet = await client.query(`DELETE FROM feed_posts WHERE id = $1`, [postId])
    if (slettet.rowCount === 0) {
        res.status(404).json({ error: 'post finnes ikke' })
        return
    }

    res.status(200).json({ ok: true })
}

export default auth(handler)
