import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { genererMorgenrapport } from '../../../../../server/feed/morgenrapport'

// Manuell trigger av morgenrapporten fra /cron. I motsetning til cron-endepunktet
// (/api/cron/morning-report) krever denne ingen klokkeslett-sjekk — admin kan kjøre
// den når som helst. genererMorgenrapport er idempotent: dedup på Oslo-dato hindrer
// at vi lager to rapporter for samme dag (returnerer grunn='allerede_postet').
const handler = async function ({ user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    console.log(`[admin/cron/morning-report] manuelt trigget av ${user.email}`)
    try {
        const resultat = await genererMorgenrapport(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('[admin/cron/morning-report] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
