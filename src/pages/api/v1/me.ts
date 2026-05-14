import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { erIFørsteRunde } from '../../../utils/isInFirstRound'
import { auth } from '../../../auth/authHandler'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, req, user, jwtPayload, client } = opts
    if (user) {
        if (req.method == 'PUT') {
            const reqBody = JSON.parse(req.body)

            const kanBette = erIFørsteRunde()
            if (reqBody.winner && kanBette) {
                await client.query(
                    `
              UPDATE users
              SET winner = $1
              WHERE id = $2;
          `,
                    [reqBody.winner, user.id],
                )
            }
            if (reqBody.topscorer && kanBette) {
                await client.query(
                    `
              UPDATE users
              SET topscorer = $1
              WHERE id = $2;
          `,
                    [reqBody.topscorer, user.id],
                )
            }
            res.status(200).json({ ok: 123 })
            return
        }

        res.status(200).json(user)
        return
    }

    const nyBruker = await client.query(
        `
        INSERT INTO users (firebase_user_id, picture, active, email, name, scoreadmin, paymentadmin, superadmin, paid, winner)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
            jwtPayload.sub,
            jwtPayload.picture,
            true,
            jwtPayload.email,
            jwtPayload.name || jwtPayload.email,
            false,
            false,
            false,
            false,
            '',
        ],
    )

    res.status(200).json(nyBruker.rows[0])
}

export default auth(handler)
