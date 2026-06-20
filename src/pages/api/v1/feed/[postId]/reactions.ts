import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { erTillattEmoji } from '../../../../../utils/feedEmoji'

// POST /api/v1/feed/:postId/reactions { emoji } — toggle din emoji-reaksjon på en
// post. Inserter hvis den ikke finnes, sletter hvis den gjør. Validerer emoji.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }
    if (req.method !== 'POST') {
        res.status(405).end()
        return
    }

    const postId = req.query.postId as string
    const reqBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const emoji = reqBody?.emoji
    if (!erTillattEmoji(emoji)) {
        res.status(400).json({ error: 'ugyldig emoji' })
        return
    }

    const post = await client.query(`SELECT 1 FROM feed_posts WHERE id = $1`, [postId])
    if (post.rowCount === 0) {
        res.status(404).json({ error: 'post finnes ikke' })
        return
    }

    const slettet = await client.query(
        `DELETE FROM feed_reactions WHERE post_id = $1 AND user_id = $2 AND emoji = $3`,
        [postId, user.id, emoji],
    )
    if (slettet.rowCount && slettet.rowCount > 0) {
        res.status(200).json({ reacted: false })
        return
    }

    await client.query(`INSERT INTO feed_reactions (post_id, user_id, emoji) VALUES ($1, $2, $3)`, [
        postId,
        user.id,
        emoji,
    ])
    res.status(200).json({ reacted: true })
}

export default auth(handler)
