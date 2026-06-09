import { NextApiRequest, NextApiResponse } from 'next'
import { erMock } from '../../../utils/erMock'
import { getPool } from '../../../auth/authHandler'
import { HOVEDLIGA_PRIS } from '../../../utils/hovedliga'

// Offentlig endepunkt — krever ikke innlogging.
// Returnerer antall betalte deltakere i hovedligaen og total premiepott.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.status(405).end()
        return
    }

    if (erMock()) {
        const betalte = 12
        res.status(200).json({ betalte, pott: betalte * HOVEDLIGA_PRIS })
        return
    }

    let client = null
    try {
        client = await getPool().connect()
        const { rows } = await client.query<{ betalte: number }>(
            `SELECT COUNT(*)::int AS betalte FROM users WHERE paid = true AND i_hovedliga = true AND active = true`,
        )
        const betalte = Number(rows[0]?.betalte ?? 0)
        res.status(200).json({ betalte, pott: betalte * HOVEDLIGA_PRIS })
    } catch (e) {
        console.error('pott endpoint error', e)
        res.status(500).end()
    } finally {
        client?.release()
    }
}
