import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { syncMatches } from '../../../../../server/syncMatches'
import { syncStandings } from '../../../../../server/syncStandings'

const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    const dryRun = req.query.dryRun === 'true'
    console.log(`[admin/cron/sync-matches] manuelt trigget av ${user.email}${dryRun ? ' (dry run)' : ''}`)
    try {
        const resultat = await syncMatches(client, dryRun)
        // Dry run rører ingenting; synk gruppetabellene bare ved ekte kjøring.
        if (dryRun) {
            res.status(200).json(resultat)
            return
        }
        let standings: Awaited<ReturnType<typeof syncStandings>> | { error: string }
        try {
            standings = await syncStandings(client)
        } catch (e) {
            console.error('[admin/cron/sync-matches] standings feilet', e)
            standings = { error: 'standings-synk feilet' }
        }
        res.status(200).json({ ...resultat, standings })
    } catch (e) {
        console.error('[admin/cron/sync-matches] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
