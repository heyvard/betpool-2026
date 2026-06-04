import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { settBehandlet } from '../../../../data/feedback'

// Marker en tilbakemelding som behandlet / ubehandlet. Kun superadmin.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, req, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }
    if (!user.superadmin) {
        res.status(403).end()
        return
    }
    if (req.method !== 'PUT' && req.method !== 'PATCH') {
        res.status(405).end()
        return
    }

    const id = req.query.id
    if (typeof id !== 'string') {
        res.status(400).json({ error: 'ugyldig_id' })
        return
    }

    const reqBody = JSON.parse(req.body)
    const behandlet = reqBody.behandlet === true

    await settBehandlet(client, id, user.id, behandlet)
    res.status(200).json({ ok: true })
}

export default auth(handler)
