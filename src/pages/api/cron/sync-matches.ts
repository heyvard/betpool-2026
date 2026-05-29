import { NextApiRequest, NextApiResponse } from 'next'
import { PoolClient } from 'pg'

import { getPool } from '../../../auth/authHandler'
import { syncMatches } from '../../../server/syncMatches'

// Cron-jobb (se vercel.json). Synker kampoppsettet fra football-data.org og
// upserter endringer (kickoff-tider, sluttspill-lag) til `matches`-tabellen.
// Beskyttet av CRON_SECRET — Vercel sender «Authorization: Bearer <secret>».
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        res.status(401).end()
        return
    }

    let client: PoolClient | null = null
    try {
        client = await getPool().connect()
        const resultat = await syncMatches(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('sync-matches feilet', e)
        res.status(500).json({ error: 'intern feil' })
    } finally {
        client?.release()
    }
}
