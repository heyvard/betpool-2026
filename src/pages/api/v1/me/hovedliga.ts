import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { loggEndring } from '../../../../data/auditLog'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (req.method !== 'PUT') {
        res.status(405).end()
        return
    }

    const body = req.body ? JSON.parse(req.body) : {}
    if (typeof body.i_hovedliga !== 'boolean') {
        res.status(400).json({ error: 'i_hovedliga må være boolean' })
        return
    }

    const før = user.i_hovedliga
    await client.query('UPDATE users SET i_hovedliga = $1 WHERE id = $2', [body.i_hovedliga, user.id])

    await loggEndring(client, {
        actorUserId: user.id,
        entitet: 'user',
        entitetNøkkel: user.id,
        handling: 'i_hovedliga',
        før,
        etter: body.i_hovedliga,
    })

    res.status(200).json({ ok: true })
}

export default auth(handler)
