import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { HOVEDLIGA_PRIS } from '../../../utils/hovedliga'

// Nøkkeltall for hovedligaen: pris per deltaker, antall deltakere (aktive
// brukere) og total pott. Brukes under Mine ligaer.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (req.method !== 'GET') {
        res.status(405).end()
        return
    }

    const { rows } = await client.query<{ antall: string }>(
        `SELECT COUNT(*)::int AS antall FROM users WHERE active = true`,
    )
    const antallDeltakere = Number(rows[0]?.antall ?? 0)

    res.status(200).json({
        pris: HOVEDLIGA_PRIS,
        antallDeltakere,
        pott: antallDeltakere * HOVEDLIGA_PRIS,
    })
}

export default auth(handler)
