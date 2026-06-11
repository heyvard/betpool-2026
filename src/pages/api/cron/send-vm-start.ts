import { NextApiRequest, NextApiResponse } from 'next'
import { PoolClient } from 'pg'

import { getPool } from '../../../auth/authHandler'
import { sendVmStartVarsel } from '../../../server/vmStart'

// Én-gangs cron-jobb. Trigges manuelt av superadmin (via /cron-siden eller curl).
// Beskyttet av CRON_SECRET — send med «Authorization: Bearer <secret>».
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        res.status(401).end()
        return
    }

    let client: PoolClient | null = null
    try {
        client = await getPool().connect()
        const resultat = await sendVmStartVarsel(client)
        res.status(200).json(resultat)
    } catch (e) {
        console.error('send-vm-start feilet', e)
        res.status(500).json({ error: 'intern feil' })
    } finally {
        client?.release()
    }
}
