import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import {
    erGyldigModell,
    kjørAiMorgenrapportDryRun,
    STANDARD_AI_MODELL,
} from '../../../../../server/feed/morgenrapportAi'
import { osloGårsdagDato } from '../../../../../server/feed/tid'

// Claude-kallet kan ta titalls sekunder (særlig førstegangs-skjemakompilering for
// structured output). Standard serverless-timeout (~10–15 s) drepte funksjonen midt
// i kallet, så ruten «bare spant» uten å returnere. Gi den rikelig tid; selve
// Claude-kallet er hardt tidsavbrutt på 55 s i genererAiMorgenrapport, godt under.
export const config = {
    maxDuration: 60,
}

// Dry run av den AI-genererte morgenrapporten. Kun superadmin. Bygger konteksten
// om natten og lar Claude (Sonnet) skrive rapporten, og returnerer både rapporten,
// rådataene og API-kostnaden. POSTER ingenting og skriver ikke til DB — dette er en
// ren forhåndsvisning superadmin kan kjøre for en valgt natt.
//
// ?dato=YYYY-MM-DD overstyrer hvilken Oslo-rapportdato natten gjelder. Utelatt →
// i går (osloGårsdagDato), som typisk er den siste ferdige natten.
const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    const datoParam = typeof req.query.dato === 'string' ? req.query.dato : undefined
    if (datoParam && !/^\d{4}-\d{2}-\d{2}$/.test(datoParam)) {
        res.status(400).json({ error: 'Ugyldig dato — forventer YYYY-MM-DD' })
        return
    }
    const rapportDato = datoParam ?? osloGårsdagDato()

    let modell = STANDARD_AI_MODELL
    const modellParam = typeof req.query.modell === 'string' ? req.query.modell : undefined
    if (modellParam !== undefined) {
        if (!erGyldigModell(modellParam)) {
            res.status(400).json({ error: 'Ugyldig modell' })
            return
        }
        modell = modellParam
    }

    console.log(`[admin/cron/morning-report-ai] dry run for ${rapportDato} (${modell}), trigget av ${user.email}`)
    try {
        const resultat = await kjørAiMorgenrapportDryRun(client, rapportDato, modell)
        res.status(200).json(resultat)
    } catch (e) {
        const melding = e instanceof Error ? e.message : 'intern feil'
        console.error('[admin/cron/morning-report-ai] feilet', e)
        // Manglende API-nøkkel er en forventet konfigurasjonsfeil — gi tydelig melding.
        res.status(500).json({ error: melding })
    }
}

export default auth(handler)
