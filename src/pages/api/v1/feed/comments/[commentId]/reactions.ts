import { ApiHandlerOpts } from '../../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../../auth/authHandler'
import { erTillattEmoji } from '../../../../../../utils/feedEmoji'

// POST /api/v1/feed/comments/:commentId/reactions { emoji } — toggle din
// emoji-reaksjon på en kommentar.
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

    const commentId = req.query.commentId as string
    const reqBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const emoji = reqBody?.emoji
    if (!erTillattEmoji(emoji)) {
        res.status(400).json({ error: 'ugyldig emoji' })
        return
    }

    const kommentar = await client.query(`SELECT 1 FROM feed_comments WHERE id = $1`, [commentId])
    if (kommentar.rowCount === 0) {
        res.status(404).json({ error: 'kommentar finnes ikke' })
        return
    }

    const slettet = await client.query(
        `DELETE FROM feed_comment_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3`,
        [commentId, user.id, emoji],
    )
    if (slettet.rowCount && slettet.rowCount > 0) {
        res.status(200).json({ reacted: false })
        return
    }

    await client.query(`INSERT INTO feed_comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3)`, [
        commentId,
        user.id,
        emoji,
    ])
    res.status(200).json({ reacted: true })
}

export default auth(handler)
