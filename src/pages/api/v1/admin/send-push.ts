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
        userId: string
        title: string
        body: string
        url?: string
    }

    if (!userId || !title?.trim() || !body?.trim()) {
        res.status(400).json({ error: 'userId, title og body er påkrevd' })
        return
    }

    try {
        const sendt = await sendPushTilBruker(client, userId, {
            title: title.trim(),
            body: body.trim(),
            url: url?.trim() || undefined,
        })
        console.log(`[admin/send-push] ${user.email} sendte til bruker ${userId}: ${sendt} enheter`)
        res.status(200).json({ sendt })
    } catch (e) {
        console.error('[admin/send-push] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
