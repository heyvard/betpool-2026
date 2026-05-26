import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

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
    const lang = body.language
    if (lang !== 'no' && lang !== 'fr') {
        res.status(400).json({ error: 'ugyldig språk' })
        return
    }

    await client.query('UPDATE users SET language = $1 WHERE id = $2', [lang, user.id])
    res.status(200).json({ ok: true })
}

export default auth(handler)
