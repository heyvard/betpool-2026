import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'

// Tømmer ALT feed-innhold. Eksplisitte, tydelige slettehandlinger i riktig
// rekkefølge (barn før forelder) — vi baserer oss IKKE på FK-cascade. Brukes for å
// nullstille feeden før en ren backfill. Admin-trigget fra /cron.
const handler = async function ({ user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    console.log(`[admin/cron/feed-reset] manuelt trigget av ${user.email}`)
    try {
        // Rekkefølge: kommentar-reaksjoner → post-reaksjoner → kommentarer → poster
        // → snapshots. Hver som egen, tydelig DELETE (full tømming, ingen WHERE).
        const kommentarReaksjoner = await client.query(`DELETE FROM feed_comment_reactions`)
        const reaksjoner = await client.query(`DELETE FROM feed_reactions`)
        const kommentarer = await client.query(`DELETE FROM feed_comments`)
        const poster = await client.query(`DELETE FROM feed_posts`)
        const snapshots = await client.query(`DELETE FROM feed_standings_snapshot`)

        res.status(200).json({
            feed_comment_reactions: kommentarReaksjoner.rowCount ?? 0,
            feed_reactions: reaksjoner.rowCount ?? 0,
            feed_comments: kommentarer.rowCount ?? 0,
            feed_posts: poster.rowCount ?? 0,
            feed_standings_snapshot: snapshots.rowCount ?? 0,
        })
    } catch (e) {
        console.error('[admin/cron/feed-reset] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
