import { NextApiRequest, NextApiResponse } from 'next'

import { getPool } from '../../../auth/authHandler'
import { erTestAuth } from '../../../utils/erTestAuth'

// Dev-only endepunkt for brukervelgeren. Returnerer 404 med mindre test-auth er på.
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (!erTestAuth()) {
        res.status(404).end()
        return
    }

    const client = await getPool().connect()
    try {
        const users = (
            await client.query(
                `SELECT id, name, firebase_user_id, superadmin, scoreadmin, paymentadmin
                 FROM users
                 ORDER BY name`,
            )
        ).rows
        res.status(200).json(users)
    } finally {
        client.release()
    }
}
