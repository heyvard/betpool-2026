import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { erGyldigModell, STANDARD_AI_MODELL } from '../../../../../server/feed/morgenrapportAi'
import { kjørPodiumDryRun } from '../../../../../server/feed/podiumAi'

// Claude-kallet kan ta titalls sekunder — se morning-report-ai.ts for samme
// begrunnelse for den utvidede maxDuration-en.
export const config = {
    maxDuration: 60,
}

// Dry run av pallen. Kun superadmin. Bygger konteksten (topp-3 i hovedligaen +
// fasiten) og lar Claude skrive oppsummeringen, men POSTER ingenting — ren
// forhåndsvisning superadmin kan kjøre før den faktiske postingen.
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

    console.log(`[admin/cron/podium-dry-run] dry run trigget av ${user.email}`)
    try {
        const resultat = await kjørPodiumDryRun(client, modell)
        res.status(200).json(resultat)
    } catch (e) {
        const melding = e instanceof Error ? e.message : 'intern feil'
        console.error('[admin/cron/podium-dry-run] feilet', e)
        res.status(500).json({ error: melding })
    }
}

export default auth(handler)
