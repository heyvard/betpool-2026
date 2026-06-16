import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { sendPushTilBruker } from '../../../../server/push'

const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }
    if (req.method !== 'POST') {
        res.status(405).end()
        return
    }

    const { userId, title, body, url } = req.body as {
        userId: string | 'alle'
        title: string
        body: string
        url?: string
    }

    if (!userId || !title?.trim() || !body?.trim()) {
        res.status(400).json({ error: 'userId, title og body er påkrevd' })
        return
    }

    const payload = { title: title.trim(), body: body.trim(), url: url?.trim() || undefined }

    try {
        if (userId === 'alle') {
            const { rows } = await client.query<{ id: string }>(
                `SELECT DISTINCT u.id FROM users u
                 JOIN push_subscriptions ps ON ps.user_id = u.id
                 WHERE u.active = true`,
            )
            let totaltSendt = 0
            for (const { id } of rows) {
                totaltSendt += await sendPushTilBruker(client, id, payload)
            }
            console.log(
                `[admin/send-push] ${user.email} sendte til alle: ${rows.length} brukere, ${totaltSendt} enheter`,
            )
            res.status(200).json({ sendt: totaltSendt, brukere: rows.length })
        } else {
            const sendt = await sendPushTilBruker(client, userId, payload)
            console.log(`[admin/send-push] ${user.email} sendte til bruker ${userId}: ${sendt} enheter`)
            res.status(200).json({ sendt })
        }
    } catch (e) {
        console.error('[admin/send-push] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
