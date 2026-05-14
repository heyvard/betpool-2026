import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (!(user.superadmin || user.scoreadmin)) {
        res.status(403).end()
        return
    }

    const { id } = req.query

    const reqBody = JSON.parse(req.body)

    if (typeof reqBody.paid !== 'undefined') {
        await client.query(
            `
                UPDATE users
                SET paid = $1
                WHERE id = $2;
            `,
            [reqBody.paid, id],
        )
    }
    if (user.superadmin) {
        if (typeof reqBody.scoreadmin !== 'undefined') {
            await client.query(
                `
                UPDATE users
                SET scoreadmin = $1
                WHERE id = $2;
            `,
                [reqBody.scoreadmin, id],
            )
        }

        if (typeof reqBody.paymentadmin !== 'undefined') {
            await client.query(
                `
                UPDATE users
                SET paymentadmin = $1
                WHERE id = $2;
            `,
                [reqBody.paymentadmin, id],
            )
        }

        if (typeof reqBody.active !== 'undefined') {
            await client.query(
                `
                UPDATE users
                SET active = $1
                WHERE id = $2;
            `,
                [reqBody.active, id],
            )
        }
    }

    res.status(200).json(reqBody)
}
export default auth(handler)
