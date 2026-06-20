import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { backfillFeed } from '../../../../../server/feed/backfill'

// Engangs-backfill av feeden: fyller på kamp-poster og morgenrapporter for de
// siste N dagene (default 2). Admin-trigget fra /cron. Idempotent.
const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    const dager = Math.min(14, Math.max(1, Number(req.query.dager) || 2))
    console.log(`[admin/cron/feed-backfill] manuelt trigget av ${user.email} (${dager} dager)`)
    try {
        const resultat = await backfillFeed(client, dager)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('[admin/cron/feed-backfill] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
