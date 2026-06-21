import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

export interface UtenforHovedligaLiga {
    id: string
    name: string
    status: 'invitert' | 'medlem'
}

export interface UtenforHovedligaBruker {
    id: string
    name: string
    email: string
    paid: boolean
    active: boolean
    bet_count: number
    // Private ligaer brukeren er med i — gir kontekst på hvorfor de står
    // utenfor hovedligaen.
    ligaer: UtenforHovedligaLiga[]
}

// GET /api/v1/admin/utenfor-hovedliga — alle brukere som har valgt bort
// hovedligaen (i_hovedliga = false), med de private ligaene de er med i.
// Kun superadmin.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    if (req.method !== 'GET') {
        res.status(405).end()
        return
    }

    const brukere = (
        await client.query<{
            id: string
            name: string
            email: string
            paid: boolean
            active: boolean
            bet_count: number
        }>(
            `SELECT u.id,
                    COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name,
                    u.email,
                    u.paid,
                    u.active,
                    COUNT(DISTINCT b.match_num)::int AS bet_count
             FROM users u
             LEFT JOIN bets b ON b.user_id = u.id
             WHERE u.i_hovedliga = false
             GROUP BY u.id
             ORDER BY COALESCE(NULLIF(u.kallenavn, ''), u.name)`,
        )
    ).rows

    const ligaer = (
        await client.query<{
            user_id: string
            id: string
            name: string
            status: 'invitert' | 'medlem'
        }>(
            `SELECT lm.user_id, l.id, l.name, lm.status
             FROM league_members lm
             JOIN leagues l ON l.id = lm.league_id
             WHERE l.deleted_at IS NULL
               AND lm.user_id IN (SELECT id FROM users WHERE i_hovedliga = false)
             ORDER BY l.name`,
        )
    ).rows

    const ligaerByUser = new Map<string, UtenforHovedligaLiga[]>()
    for (const l of ligaer) {
        const { user_id, ...rest } = l
        if (!ligaerByUser.has(user_id)) ligaerByUser.set(user_id, [])
        ligaerByUser.get(user_id)!.push(rest)
    }

    const result: UtenforHovedligaBruker[] = brukere.map((b) => ({
        ...b,
        ligaer: ligaerByUser.get(b.id) ?? [],
    }))

    res.status(200).json(result)
}

export default auth(handler)
