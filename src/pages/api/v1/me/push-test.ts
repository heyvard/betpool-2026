import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { sendPushTilBruker } from '../../../../server/push'

// Sender et testvarsel til alle enhetene til innlogget bruker.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }
    if (req.method !== 'POST') {
        res.status(405).end()
        return
    }

    const sendt = await sendPushTilBruker(client, user.id, {
        title: 'VM Betpool',
        body: 'Testvarsel — push funker! 🎉',
        url: '/my-bets',
    })

    if (sendt === 0) {
        res.status(409).json({ error: 'fant ingen aktive abonnement å sende til' })
        return
    }
    res.status(200).json({ sendt })
}

export default auth(handler)
