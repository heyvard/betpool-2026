import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { hentFeed } from '../../../server/feed/hentFeed'

// GET /api/v1/feed — siste poster i hovedligaens feed (Æresligaen), nyeste først,
// med aggregerte reaksjoner og kommentarer (kommentarer har egne reaksjoner).
// `mine` regnes ut fra innlogget bruker.

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }
    // Mock-modus har ingen DB-klient — vis tom feed.
    if (!client) {
        res.json({ posts: [] })
        return
    }

    const posts = await hentFeed(client, user.id)
    res.json({ posts })
}

export default auth(handler)
