import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { syncScores } from '../../../../../server/syncScores'

const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    const dryRun = req.query.dryRun === 'true'
    console.log(`[admin/cron/sync-scores] manuelt trigget av ${user.email}${dryRun ? ' (dry run)' : ''}`)
    try {
        const resultat = dryRun ? await syncScores(client, true) : await syncScores(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('[admin/cron/sync-scores] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
