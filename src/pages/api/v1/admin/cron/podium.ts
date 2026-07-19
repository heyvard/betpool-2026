import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { erGyldigModell, STANDARD_AI_MODELL } from '../../../../../server/feed/morgenrapportAi'
import { genererOgLagrePodium } from '../../../../../server/feed/podiumAi'

// Claude-kallet kan ta titalls sekunder — se morning-report.ts for samme
// begrunnelse for den utvidede maxDuration-en.
export const config = {
    maxDuration: 60,
}

// Superadmin trykker denne når alle resultater er verifisert: poster pallen
// (topp-3 i hovedligaen + en AI-skrevet oppsummering av reisen deres) i
// feeden. Idempotent — kun én pallen-post noensinne (feed_posts_podium_unik_idx),
// og krever at vinneren er satt på /vinner-toppscorer først.
const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    let modell = STANDARD_AI_MODELL
    const modellParam = typeof req.query.modell === 'string' ? req.query.modell : undefined
    if (modellParam !== undefined) {
        if (!erGyldigModell(modellParam)) {
            res.status(400).json({ error: 'Ugyldig modell' })
            return
        }
        modell = modellParam
    }

    console.log(`[admin/cron/podium] manuelt trigget av ${user.email}`)
    try {
        const resultat = await genererOgLagrePodium(client, { modell })
        res.status(200).json(resultat)
    } catch (e) {
        const melding = e instanceof Error ? e.message : 'intern feil'
        console.error('[admin/cron/podium] feilet', e)
        res.status(500).json({ error: melding })
    }
}

export default auth(handler)
