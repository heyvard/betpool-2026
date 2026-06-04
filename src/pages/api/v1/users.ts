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
                       COUNT(ps.id)::int AS device_count
                FROM users u
                LEFT JOIN push_subscriptions ps ON ps.user_id = u.id
                GROUP BY u.id`,
        )
    ).rows
    res.status(200).json(users)
}
export default auth(handler)
