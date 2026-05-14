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
                       u.name,
                       u.paid,
                       u.superadmin,
                       u.paymentadmin,
                       u.scoreadmin,
                       u.active
                FROM users u`,
        )
    ).rows
    res.status(200).json(users)
}
export default auth(handler)
