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

    const isMockQuery = req.query.mockWinner || req.query.mockTopscorerIds

    console.log(`[admin/cron/podium-dry-run] dry run trigget av ${user.email}${isMockQuery ? ' (mock-data)' : ''}`)
    try {
        const mockOpts = isMockQuery
            ? {
                  mockWinner: typeof req.query.mockWinner === 'string' ? req.query.mockWinner : undefined,
                  mockTopscorerIds:
                      typeof req.query.mockTopscorerIds === 'string'
                          ? req.query.mockTopscorerIds
                                .split(',')
                                .map((id) => parseInt(id, 10))
                                .filter((id) => !isNaN(id))
                          : undefined,
              }
            : undefined

        const resultat = await kjørPodiumDryRun(client, modell, mockOpts)
        res.status(200).json(resultat)
    } catch (e) {
        const melding = e instanceof Error ? e.message : 'intern feil'
        console.error('[admin/cron/podium-dry-run] feilet', e)
        res.status(500).json({ error: melding })
    }
}

export default auth(handler)
