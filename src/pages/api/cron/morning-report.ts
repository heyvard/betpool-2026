import { NextApiRequest, NextApiResponse } from 'next'
import { PoolClient } from 'pg'

import { getPool } from '../../../auth/authHandler'
import { genererMorgenrapport } from '../../../server/feed/morgenrapport'
import { osloTime } from '../../../server/feed/tid'
import { syncMatches } from '../../../server/syncMatches'

// Morgenrapport-cron, ment å treffe 08:00 norsk tid. Vercel/GHA-cron kjører i
// UTC, og 08:00 Oslo er 06:00 UTC (sommer) / 07:00 UTC (vinter). Robust løsning:
// planlegg «0 6 * * *» OG «0 7 * * *», og avbryt tidlig her hvis klokka i
// Europe/Oslo ikke er 8. UNIQUE på dato hindrer at begge kjøringene poster.
// Beskyttet av CRON_SECRET. (Cron-oppsettet wires opp i GitHub Actions.)
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        res.status(401).end()
        return
    }

    // `force` lar admin trigge manuelt utenom kl 8 (f.eks. fra /cron-siden).
    const force = req.query.force === '1' || req.query.force === 'true'
    if (!force && osloTime() !== 8) {
        res.status(200).json({ skipped: true, grunn: `ikke kl 8 i Oslo (er ${osloTime()})` })
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
