import { NextApiRequest, NextApiResponse } from 'next'
import { PoolClient } from 'pg'

import { getPool } from '../../../auth/authHandler'
import { syncScores } from '../../../server/syncScores'
import { genererKampposter } from '../../../server/feed/genererKamppost'

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
        // Generer feed-kampposter for nylig ferdige kamper. Aldri en blokkering.
        try {
            await genererKampposter(client)
        } catch (e) {
            console.error('[feed] kunne ikke generere kampposter', e)
        }
        res.status(200).json(resultat)
    } catch (e) {
        console.error('sync-scores feilet', e)
        res.status(500).json({ error: 'intern feil' })
    } finally {
        client?.release()
    }
}
