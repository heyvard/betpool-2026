import { NextApiRequest, NextApiResponse } from 'next'
import { Pool, PoolClient } from 'pg'

import { User } from '../types/db'
import { ApiHandlerOpts } from '../types/apiHandlerOpts'
import { erMock } from '../utils/erMock'

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
                    email: 'adsfdsf',
                    admin: false,
                    superadmin: false,
                    paymentadmin: false,
                    paid: false,
                    scoreadmin: false,
                    athlete_id: '1',
                    active: true,
                    done: true,
                } as User,
            })
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
                if (process.env.VM === 'true') {
                    await client.query('SET search_path TO vm_2022')
                }
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
