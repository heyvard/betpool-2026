import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

// Lagrer (PUT) eller fjerner (DELETE) et web push-abonnement for innlogget bruker.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (req.method === 'PUT') {
        const sub = JSON.parse(req.body)
        const endpoint = sub?.endpoint
        const p256dh = sub?.keys?.p256dh
        const authKey = sub?.keys?.auth
        if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof authKey !== 'string') {
            res.status(400).json({ error: 'ugyldig push-abonnement' })
            return
        }

        await client.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (endpoint)
             DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, updated_at = now()`,
            [user.id, endpoint, p256dh, authKey],
        )
        res.status(200).json({ ok: true })
        return
    }

    if (req.method === 'DELETE') {
        const body = req.body ? JSON.parse(req.body) : {}
        const endpoint = body?.endpoint
        if (typeof endpoint !== 'string') {
            res.status(400).json({ error: 'endpoint mangler' })
            return
        }
        await client.query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [user.id, endpoint])
        res.status(200).json({ ok: true })
        return
    }

    res.status(405).end()
}

export default auth(handler)
