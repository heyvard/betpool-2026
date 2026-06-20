import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { visningsnavn } from '../../../../../server/feed/maler'

const MAKS_LENGDE = 500

// POST /api/v1/feed/:postId/comments { body } — opprett en kommentar på en post.
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
    const tekst = typeof reqBody?.body === 'string' ? reqBody.body.trim() : ''
    if (!tekst) {
        res.status(400).json({ error: 'tom kommentar' })
        return
    }
    if (tekst.length > MAKS_LENGDE) {
        res.status(400).json({ error: `kommentaren er for lang (maks ${MAKS_LENGDE} tegn)` })
        return
    }

    const post = await client.query(`SELECT 1 FROM feed_posts WHERE id = $1`, [postId])
    if (post.rowCount === 0) {
        res.status(404).json({ error: 'post finnes ikke' })
        return
    }

    const insert = await client.query<{ id: string; created_at: string }>(
        `INSERT INTO feed_comments (post_id, user_id, body) VALUES ($1, $2, $3) RETURNING id, created_at`,
        [postId, user.id, tekst],
    )

    const navn = visningsnavn(user.kallenavn?.trim() || user.name)
    res.status(201).json({
        id: insert.rows[0].id,
        navn,
        picture: user.picture ?? null,
        body: tekst,
        created_at: insert.rows[0].created_at,
        reactions: [],
    })
}

export default auth(handler)
