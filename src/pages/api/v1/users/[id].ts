import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { loggEndring } from '../../../../data/auditLog'

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

    const førRad = (
        await client.query<{ paid: boolean; scoreadmin: boolean; paymentadmin: boolean; active: boolean }>(
            `SELECT paid, scoreadmin, paymentadmin, active FROM users WHERE id = $1`,
            [id],
        )
    ).rows[0]

    // Samle opp hvilke flagg som faktisk ble endret, så vi kan skrive én
    // audit-rad med før/etter for nettopp disse feltene.
    const før: Record<string, boolean> = {}
    const etter: Record<string, boolean> = {}

    if (typeof reqBody.paid !== 'undefined') {
        await client.query(
            `
                UPDATE users
                SET paid = $1
                WHERE id = $2;
            `,
            [reqBody.paid, id],
        )
        før.paid = førRad?.paid
        etter.paid = reqBody.paid
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
            før.scoreadmin = førRad?.scoreadmin
            etter.scoreadmin = reqBody.scoreadmin
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
            før.paymentadmin = førRad?.paymentadmin
            etter.paymentadmin = reqBody.paymentadmin
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
            før.active = førRad?.active
            etter.active = reqBody.active
        }
    }

    if (Object.keys(etter).length > 0) {
        await loggEndring(client, {
            actorUserId: user.id,
            entitet: 'user',
            entitetNøkkel: String(id),
            handling: 'endre_bruker',
            før,
            etter,
        })
    }

    res.status(200).json(reqBody)
}
export default auth(handler)
