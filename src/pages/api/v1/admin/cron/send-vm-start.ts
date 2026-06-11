import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { dryRunVmStartVarsel, sendVmStartVarsel } from '../../../../../server/vmStart'

const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    const dryRun = req.query.dryRun === 'true'
    console.log(`[admin/cron/send-vm-start] manuelt trigget av ${user.email}${dryRun ? ' (dry run)' : ''}`)
    try {
        const resultat = dryRun ? await dryRunVmStartVarsel(client) : await sendVmStartVarsel(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('[admin/cron/send-vm-start] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
