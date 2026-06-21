import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { backfillFeed } from '../../../../../server/feed/backfill'

// Full backfill av feeden: fyller kamp-poster og morgenrapporter for hele
// turneringen (fra første ferdige kamp til i dag) i én kjøring. Admin-trigget fra
// /cron. Idempotent — dedup på kamp (match_num) og dato, så allerede backfilte
// dager/kamper hoppes over.
const handler = async function ({ user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    console.log(`[admin/cron/feed-backfill] full backfill manuelt trigget av ${user.email}`)
    try {
        const resultat = await backfillFeed(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('[admin/cron/feed-backfill] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
