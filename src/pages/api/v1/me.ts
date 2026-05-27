import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { erIFørsteRunde, erIEndrevindu } from '../../../utils/isInFirstRound'
import { auth } from '../../../auth/authHandler'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, req, user, jwtPayload, client } = opts
    if (user) {
        if (req.method == 'PUT') {
            const reqBody = JSON.parse(req.body)

            if (reqBody.winner) {
                if (erIFørsteRunde(req)) {
                    await client.query(`UPDATE users SET winner = $1 WHERE id = $2`, [reqBody.winner, user.id])
                } else if (erIEndrevindu(req) && !user.winner_endret && user.winner) {
                    await client.query(`UPDATE users SET winner = $1, winner_endret = true WHERE id = $2`, [
                        reqBody.winner,
                        user.id,
                    ])
                }
            }
            if (reqBody.topscorer !== undefined) {
                if (erIFørsteRunde(req)) {
                    await client.query(`UPDATE users SET topscorer = $1 WHERE id = $2`, [reqBody.topscorer, user.id])
                } else if (erIEndrevindu(req) && !user.topscorer_endret && user.topscorer) {
                    await client.query(`UPDATE users SET topscorer = $1, topscorer_endret = true WHERE id = $2`, [
                        reqBody.topscorer,
                        user.id,
                    ])
                }
            }
            if (reqBody.onboarded === true) {
                await client.query(`UPDATE users SET onboarded_at = NOW() WHERE id = $1 AND onboarded_at IS NULL`, [
                    user.id,
                ])
            }
            res.status(200).json({ ok: 123 })
            return
        }

        res.status(200).json(user)
        return
    }

    try {
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
    } catch (err: any) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'email_conflict' })
            return
        }
        throw err
    }
}

export default auth(handler)
