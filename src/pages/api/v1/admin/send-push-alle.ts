import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { sendPushTilAlle } from '../../../../server/push'

const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }
    if (req.method !== 'POST') {
        res.status(405).end()
        return
    }

    const { title, body, url } = JSON.parse(req.body as string) as {
        title: string
        body: string
        url?: string
    }

    if (!title?.trim() || !body?.trim()) {
        res.status(400).json({ error: 'title og body er påkrevd' })
        return
    }

    try {
        const resultat = await sendPushTilAlle(client, {
            title: title.trim(),
            body: body.trim(),
            url: url?.trim() || undefined,
        })
        console.log(
            `[admin/send-push-alle] ${user.email} kringkastet til ${resultat.brukere} brukere (${resultat.enheter} enheter)`,
        )
        res.status(200).json(resultat)
    } catch (e) {
        console.error('[admin/send-push-alle] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
