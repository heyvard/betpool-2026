import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

const BASE_URL = 'https://api.football-data.org/v4'

// Superadmin-debug: henter én enkelt kamp rett fra football-data.org sitt
// /v4/matches/{id}-endepunkt og returnerer rå-responsen (+ status), så vi kan se
// nøyaktig hva API-et svarer for en gitt kamp. `id` = football-data sin match-id
// (= vår match_num).
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user } = opts
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    const id = typeof req.query.id === 'string' ? req.query.id : null
    if (!id || !/^\d+$/.test(id)) {
        res.status(400).json({ error: 'Mangler eller ugyldig match-id (?id=)' })
        return
    }

    const token = process.env.FOOTBALL_DATA_TOKEN
    if (!token) {
        res.status(500).json({ error: 'Mangler FOOTBALL_DATA_TOKEN' })
        return
    }

    const url = `${BASE_URL}/matches/${id}`
    try {
        const apiRes = await fetch(url, { headers: { 'X-Auth-Token': token } })
        const text = await apiRes.text()
        let body: unknown
        try {
            body = JSON.parse(text)
        } catch {
            body = text
        }
        res.status(200).json({ url, status: apiRes.status, ok: apiRes.ok, body })
    } catch (e) {
        res.status(200).json({ url, status: null, ok: false, body: null, feil: String(e) })
    }
}

export default auth(handler)
