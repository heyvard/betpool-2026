import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

// /api/v1/leagues/invitable-users
//  GET — alle aktive brukere (id/navn/bilde) til invitasjonsplukkeren. Statisk
//  segment, så den vinner over [id] i Next pages-routeren. Ingen ny eksponering:
//  /api/v1/bets deler allerede alle aktive brukeres navn og bilde.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    const brukere = (
        await client.query<{ id: string; name: string; picture: string | null }>(
            `SELECT id, name, picture FROM users WHERE active = true ORDER BY name`,
        )
    ).rows

    res.status(200).json(brukere)
}

export default auth(handler)
