import { NextApiRequest, NextApiResponse } from 'next'
import { PoolClient } from 'pg'

import { getPool } from '../../../auth/authHandler'
import { syncScores } from '../../../server/syncScores'
import { genererFeedTrygt } from '../../../server/syncAll'

// genererFeedTrygt kan fyre den AI-genererte morgenrapporten (Claude) når nattens
// siste kamp blir ferdig — det kallet tar titalls sekunder. Gi ruten rikelig tid så
// den ikke drepes midt i kallet. Claude-kallet er hardt tidsavbrutt på 55 s.
export const config = {
    maxDuration: 60,
}

// Cron-jobb trigget av GHA hvert 15. minutt. Henter scores for pågående og
// nylig ferdige kamper fra football-data.org og upserter synced_*-kolonner
// i match_scores. Beskyttet av CRON_SECRET.
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        res.status(401).end()
        return
    }

    let client: PoolClient | null = null
    try {
        client = await getPool().connect()
        const resultat = await syncScores(client)
        // Fyr ev. morgenrapport når nattens siste kamp ble ferdig — basert KUN på
        // kamper som akkurat ble ferdige denne synken. genererFeedTrygt svelger egne
        // feil — aldri en blokkering for synken.
        await genererFeedTrygt(client, resultat.nyligFerdige)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('sync-scores feilet', e)
        res.status(500).json({ error: 'intern feil' })
    } finally {
        client?.release()
    }
}
