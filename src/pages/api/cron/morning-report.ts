import { NextApiRequest, NextApiResponse } from 'next'
import { PoolClient } from 'pg'

import { getPool } from '../../../auth/authHandler'
import { genererMorgenrapport } from '../../../server/feed/morgenrapport'
import { osloTime } from '../../../server/feed/tid'
import { syncMatches } from '../../../server/syncMatches'

// Morgenrapport-cron, ment å treffe morgenen norsk tid. GHA-cron kjører i UTC og
// leveres ofte 1–2 timer for sent (observert: planlagt 06:00 UTC, faktisk kjørt
// 07:17–08:05 UTC = 09–10 Oslo). En streng «kl. 8 nøyaktig»-sjekk gjorde da at
// rapporten i praksis aldri ble generert — hver forsinkede kjøring returnerte 200
// {skipped} og så «grønn» ut i Actions. Vi godtar derfor et helt morgenvindu
// (08–11 Oslo). Rapporten er uansett forankret til 08:00 (osloInstant(iDag, 8) i
// genererMorgenrapport), så innholdet er identisk uavhengig av når i vinduet den
// kjører, og UNIQUE på dato + idempotens-sjekken hindrer dobbel-post når flere
// kjøringer treffer vinduet. Beskyttet av CRON_SECRET. Cron-oppsettet (flere
// tidspunkt for å tåle GHA-forsinkelser) wires opp i GitHub Actions.
const MORGEN_VINDU_FRA = 8
const MORGEN_VINDU_TIL = 11 // inklusiv — dekker et par timers GHA-forsinkelse
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        res.status(401).end()
        return
    }

    // `force` lar admin trigge manuelt utenom morgenvinduet (f.eks. fra /cron-siden).
    const force = req.query.force === '1' || req.query.force === 'true'
    const time = osloTime()
    if (!force && (time < MORGEN_VINDU_FRA || time > MORGEN_VINDU_TIL)) {
        res.status(200).json({
            skipped: true,
            grunn: `utenfor morgenvindu (${MORGEN_VINDU_FRA}–${MORGEN_VINDU_TIL} Oslo, er ${time})`,
        })
        return
    }

    let client: PoolClient | null = null
    try {
        client = await getPool().connect()
        try {
            await syncMatches(client)
        } catch (syncFeil) {
            console.warn('morning-report: kamp-synk feilet, fortsetter med rapport', syncFeil)
        }
        const resultat = await genererMorgenrapport(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('morning-report feilet', e)
        res.status(500).json({ error: 'intern feil' })
    } finally {
        client?.release()
    }
}
