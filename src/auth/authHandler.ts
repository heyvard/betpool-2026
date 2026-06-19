import { NextApiRequest, NextApiResponse } from 'next'
import { Pool, PoolClient } from 'pg'

import { User } from '../types/db'
import { ApiHandlerOpts } from '../types/apiHandlerOpts'
import { erMock } from '../utils/erMock'
import { erTestAuth } from '../utils/erTestAuth'

import { verifiserIdToken } from './verifiserIdToken'

let pool: null | Pool

export function getPool() {
    if (!pool) {
        const connectionString = process.env.POSTGRES_URL_NON_POOLING
        pool = new Pool({
            connectionString,
            max: 1,
        })
    }
    return pool
}

export function auth(fn: { (_opts: ApiHandlerOpts): Promise<void> }) {
    if (erMock()) {
        return async (req: NextApiRequest, res: NextApiResponse) => {
            await fn({
                req,
                res,
                jwtPayload: {},
                client: null as any,
                user: {
                    id: '1',
                    firebase_user_id: '1',
                    picture: 'https://www.nav.no',
                    name: 'Testy',
                    kallenavn: null,
                    email: 'adsfdsf',
                    admin: false,
                    superadmin: false,
                    paymentadmin: false,
                    paid: false,
                    scoreadmin: false,
                    athlete_id: '1',
                    active: true,
                    done: true,
                    notif_general: true,
                    notif_reminders: true,
                    notif_summary: true,
                    onboarded_at: new Date().toISOString(),
                    winner: '',
                    topscorer: undefined,
                    topscorer_player_id: null,
                    topscorer_forrige_player_id: null,
                    winner_endret: false,
                    topscorer_endret: false,
                    winner_forrige: null,
                    topscorer_forrige: null,
                    i_hovedliga: true,
                } as User,
            })
        }
    }
    if (erTestAuth()) {
        // Test-auth-modus: hopper over Firebase-JWT, men beholder ekte DB-klient.
        // Brukeren velges via «x-test-user»-header eller «betpool_test_user»-cookie.
        // Gated på NEXT_PUBLIC_TEST_AUTH — settes aldri i prod.
        return async (req: NextApiRequest, res: NextApiResponse) => {
            const testUserId = (req.headers['x-test-user'] as string | undefined) ?? req.cookies['betpool_test_user']
            if (!testUserId) {
                res.status(401).end()
                return
            }
            let client: PoolClient | null = null
            try {
                client = await getPool().connect()
                // Brukeren kan mangle i DB — handlere som me.ts oppretter den da selv.
                const userList = await client.query('SELECT * from users where firebase_user_id = $1', [testUserId])
                await fn({
                    req,
                    res,
                    jwtPayload: { sub: testUserId, email: `${testUserId}@test.local`, name: testUserId },
                    client,
                    user: userList.rows[0],
                })
            } finally {
                client?.release()
            }
        }
    }

    return async (req: NextApiRequest, res: NextApiResponse) => {
        try {
            const authheader = req.headers.authorization
            if (!authheader) {
                res.status(401)
                return
            }

            const verifisert = await verifiserIdToken(authheader.split(' ')[1])
            if (!verifisert) {
                res.status(401)
                return
            }

            let client: PoolClient | null = null
            try {
                client = await getPool().connect()
                const userList = await client.query('SELECT * from users where firebase_user_id = $1', [
                    verifisert.payload.sub!,
                ])

                const hentBrukeren = (): User | undefined => {
                    if (userList.rows.length == null) {
                        return undefined
                    }
                    return userList.rows[0]
                }

                await fn({ req, res, jwtPayload: verifisert.payload, client, user: hentBrukeren() })
            } finally {
                client?.release()
            }
        } catch (e) {
            console.log('oops', e)
        }
    }
}
