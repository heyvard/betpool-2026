import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { LeagueMember } from '../../../../types/league'

export interface AdminLiga {
    id: string
    name: string
    owner_user_id: string
    owner_name: string
    innsats: number | null
    betalingsinfo: string | null
    created_at: string
    members: LeagueMember[]
}

// GET /api/v1/admin/ligaer — alle private ligaer med medlemsliste (kun superadmin).
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

    const ligaer = (
        await client.query<{
            id: string
            name: string
            owner_user_id: string
            owner_name: string
            innsats: number | null
            betalingsinfo: string | null
            created_at: string
        }>(
            `SELECT l.id, l.name, l.owner_user_id, l.innsats, l.betalingsinfo, l.created_at,
                    ou.name AS owner_name
             FROM leagues l
             JOIN users ou ON ou.id = l.owner_user_id
             WHERE l.deleted_at IS NULL
             ORDER BY l.created_at DESC`,
        )
    ).rows

    const members = (
        await client.query<{
            league_id: string
            user_id: string
            name: string
            picture: string | null
            status: 'invitert' | 'medlem'
            paid: boolean
        }>(
            `SELECT lm.league_id, lm.user_id,
                    COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name,
                    u.picture, lm.status, lm.paid
             FROM league_members lm
             JOIN users u ON u.id = lm.user_id
             WHERE lm.league_id IN (SELECT id FROM leagues WHERE deleted_at IS NULL)
             ORDER BY COALESCE(NULLIF(u.kallenavn, ''), u.name)`,
        )
    ).rows

    const membersByLeague = new Map<string, LeagueMember[]>()
    for (const m of members) {
        const { league_id, ...rest } = m
        if (!membersByLeague.has(league_id)) membersByLeague.set(league_id, [])
        membersByLeague.get(league_id)!.push(rest)
    }

    const result: AdminLiga[] = ligaer.map((l) => ({
        ...l,
        members: membersByLeague.get(l.id) ?? [],
    }))

    res.status(200).json(result)
}

export default auth(handler)
