import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { syncStandings } from '../../../../../server/syncStandings'

const handler = async function ({ user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    console.log(`[admin/cron/sync-standings] manuelt trigget av ${user.email}`)
    try {
        const resultat = await syncStandings(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('[admin/cron/sync-standings] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
