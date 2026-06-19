import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { erIEndrevinduMed, erIFørsteRundeMed, hentFrister } from '../../../utils/isInFirstRound'
import { auth } from '../../../auth/authHandler'
import { sendPushTilBruker } from '../../../server/push'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, req, user, jwtPayload, client } = opts
    const signInProvider = (jwtPayload.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider ?? null
    if (user) {
        // Backfill/oppdater innloggingsmetode ved innlogging. Skriver kun når den
        // faktisk er endret, så ingen unødvendige writes per sidelast.
        if (signInProvider && user.sign_in_provider !== signInProvider) {
            await client.query(`UPDATE users SET sign_in_provider = $1 WHERE id = $2`, [signInProvider, user.id])
            user.sign_in_provider = signInProvider
        }
        if (req.method == 'PUT') {
            const reqBody = JSON.parse(req.body)

            if (reqBody.winner || reqBody.topscorerPlayerId !== undefined) {
                const frister = await hentFrister(client)
                const iFørsteRunde = erIFørsteRundeMed(frister, req)
                const iEndrevindu = erIEndrevinduMed(frister, req)

                if (reqBody.winner) {
                    if (iFørsteRunde) {
                        await client.query(`UPDATE users SET winner = $1 WHERE id = $2`, [reqBody.winner, user.id])
                    } else if (iEndrevindu && !user.winner_endret && user.winner) {
                        await client.query(
                            `UPDATE users SET winner = $1, winner_endret = true, winner_forrige = $2 WHERE id = $3`,
                            [reqBody.winner, user.winner, user.id],
                        )
                    }
                }
                // Strukturert toppscorer-tipp: peker til en rad i players. null betyr
                // «ikke valgt». Fritekst-kolonnen topscorer røres ikke lenger herfra.
                if (reqBody.topscorerPlayerId !== undefined) {
                    const playerId = reqBody.topscorerPlayerId === null ? null : Number(reqBody.topscorerPlayerId)
                    if (playerId !== null && !Number.isInteger(playerId)) {
                        res.status(400).json({ error: 'topscorerPlayerId må være et heltall eller null' })
                        return
                    }
                    if (playerId !== null) {
                        const finnes = await client.query(`SELECT 1 FROM players WHERE id = $1`, [playerId])
                        if (finnes.rowCount === 0) {
                            res.status(400).json({ error: 'Ukjent spiller' })
                            return
                        }
                    }
                    if (iFørsteRunde) {
                        await client.query(`UPDATE users SET topscorer_player_id = $1 WHERE id = $2`, [
                            playerId,
                            user.id,
                        ])
                    } else if (iEndrevindu && !user.topscorer_endret && user.topscorer_player_id != null) {
                        await client.query(
                            `UPDATE users SET topscorer_player_id = $1, topscorer_endret = true, topscorer_forrige_player_id = $2 WHERE id = $3`,
                            [playerId, user.topscorer_player_id, user.id],
                        )
                    }
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
        INSERT INTO users (firebase_user_id, picture, active, email, name, scoreadmin, paymentadmin, superadmin, paid, winner, sign_in_provider)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
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
                signInProvider,
            ],
        )
        try {
            const superadmins = await client.query<{ id: string }>(
                `SELECT id FROM users WHERE superadmin = true AND notif_general = true`,
            )
            const nyBrukerNavn = nyBruker.rows[0].name || nyBruker.rows[0].email
            await Promise.all(
                superadmins.rows.map((sa) =>
                    sendPushTilBruker(client, sa.id, {
                        title: 'Ny bruker registrert',
                        body: `${nyBrukerNavn} har registrert seg.`,
                        url: '/brukere',
                    }).catch((err) => console.error('Push til superadmin feilet:', err)),
                ),
            )
        } catch (err) {
            console.error('Feil ved varsling av superadmins:', err)
        }
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
