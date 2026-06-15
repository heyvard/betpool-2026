import { NextApiRequest, NextApiResponse } from 'next'
import { PoolClient } from 'pg'

import { getPool } from '../../../auth/authHandler'
import { syncAll } from '../../../server/syncAll'

// Cron-jobb (GitHub Actions). Gjør én fetch mot football-data.org og oppdaterer
// både kampoppsett og scores i samme kjøring. Beskyttet av CRON_SECRET.
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        res.status(401).end()
        return
    }

    let client: PoolClient | null = null
    try {
        client = await getPool().connect()
        const resultat = await syncAll(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('sync feilet', e)
        res.status(500).json({ error: 'intern feil' })
    } finally {
        client?.release()
    }
}
