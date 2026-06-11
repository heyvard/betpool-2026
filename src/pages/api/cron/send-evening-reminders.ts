import { NextApiRequest, NextApiResponse } from 'next'
import { PoolClient } from 'pg'

import { getPool } from '../../../auth/authHandler'
import { sendEttermiddagsVarsler } from '../../../server/reminders'

// Trigges manuelt eller av GitHub Actions cron. Sender push-påminnelser for
// kamper som starter i kveld/natt. Beskyttet av CRON_SECRET.
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        res.status(401).end()
        return
    }

    let client: PoolClient | null = null
    try {
        client = await getPool().connect()
        const resultat = await sendEttermiddagsVarsler(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('send-evening-reminders feilet', e)
        res.status(500).json({ error: 'intern feil' })
    } finally {
        client?.release()
    }
}
