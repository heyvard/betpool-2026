import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

// Lagrer brukerens eget kallenavn. Tom streng nullstiller (faller tilbake til
// det vanlige `name`). Maks 30 tegn. Fallback til `name` gjøres i spørringene
// som leser ut navn (se f.eks. /api/v1/bets) via COALESCE(NULLIF(...)).
const MAKS_LENGDE = 30

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
    if (typeof body.kallenavn !== 'string') {
        res.status(400).json({ error: 'kallenavn må være en streng' })
        return
    }

    const kallenavn = body.kallenavn.trim()
    if (kallenavn.length > MAKS_LENGDE) {
        res.status(400).json({ error: `kallenavn kan være maks ${MAKS_LENGDE} tegn` })
        return
    }

    await client.query(`UPDATE users SET kallenavn = $1 WHERE id = $2`, [kallenavn, user.id])
    res.status(200).json({ ok: true })
}

export default auth(handler)
