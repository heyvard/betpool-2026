import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (!(user.superadmin || user.scoreadmin)) {
        res.status(403).end()
        return
    }

    const users = (
        await client.query(
            `
                SELECT u.id,
                       u.email,
                       COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name,
                       u.paid,
                       u.superadmin,
                       u.paymentadmin,
                       u.scoreadmin,
                       u.active,
                       u.notif_general,
                       u.notif_reminders,
                       u.notif_summary,
                       u.i_hovedliga,
                       u.sign_in_provider,
                       COUNT(DISTINCT ps.id)::int AS device_count,
                       COUNT(DISTINCT b.match_num)::int AS bet_count,
                       MAX(b.updated_at) AS last_bet_at,
                       (
                           SELECT MIN(m.game_start)
                           FROM matches m
                           WHERE NOT EXISTS (
                               SELECT 1 FROM bets b2
                               WHERE b2.user_id = u.id AND b2.match_num = m.match_num
                           )
                           AND m.game_start > NOW()
                       ) AS earliest_unbet_match
                FROM users u
                LEFT JOIN push_subscriptions ps ON ps.user_id = u.id
                LEFT JOIN bets b ON b.user_id = u.id
                GROUP BY u.id`,
        )
    ).rows
    res.status(200).json(users)
}
export default auth(handler)
