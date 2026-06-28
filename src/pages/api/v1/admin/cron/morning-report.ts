import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { genererOgLagreAiMorgenrapport } from '../../../../../server/feed/morgenrapportAi'

// Claude-kallet kan ta titalls sekunder. Standard serverless-timeout (~10–15 s) ville
// drept funksjonen midt i kallet; gi den rikelig tid. Selve Claude-kallet er hardt
// tidsavbrutt på 55 s i genererAiMorgenrapport, godt under denne grensen.
export const config = {
    maxDuration: 60,
}

// Manuell trigger av morgenrapporten fra /cron. I motsetning til cron-endepunktet
// (/api/cron/morning-report) krever denne ingen klokkeslett-sjekk — admin kan kjøre
// den når som helst. Poster den AI-genererte morgenrapporten (Claude) i feeden.
// genererOgLagreAiMorgenrapport er idempotent: dedup på Oslo-dato hindrer at vi lager
// to rapporter for samme dag (returnerer grunn='allerede_postet').
const handler = async function ({ user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    console.log(`[admin/cron/morning-report] manuelt trigget av ${user.email}`)
    try {
        const resultat = await genererOgLagreAiMorgenrapport(client)
        res.status(200).json(resultat)
    } catch (e) {
        const melding = e instanceof Error ? e.message : 'intern feil'
        console.error('[admin/cron/morning-report] feilet', e)
        res.status(500).json({ error: melding })
    }
}

export default auth(handler)
