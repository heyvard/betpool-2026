import { api, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

async function iHovedliga(firebaseUserId: string): Promise<boolean> {
    return withDb(async (c) => {
        const r = await c.query<{ i_hovedliga: boolean }>(`SELECT i_hovedliga FROM users WHERE firebase_user_id = $1`, [
            firebaseUserId,
        ])
        return r.rows[0].i_hovedliga
    })
}

describe('/api/v1/me/hovedliga', () => {
    it('PUT setter i_hovedliga til false og tilbake til true', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        expect(await iHovedliga('alice')).toBe(true)

        const av = await api('/api/v1/me/hovedliga', { user: 'alice', method: 'PUT', body: { i_hovedliga: false } })
        expect(av.status).toBe(200)
        expect(await iHovedliga('alice')).toBe(false)

        const på = await api('/api/v1/me/hovedliga', { user: 'alice', method: 'PUT', body: { i_hovedliga: true } })
        expect(på.status).toBe(200)
        expect(await iHovedliga('alice')).toBe(true)
    })

    it('avviser ikke-boolean verdi', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        const res = await api('/api/v1/me/hovedliga', { user: 'alice', method: 'PUT', body: { i_hovedliga: 'nei' } })
        expect(res.status).toBe(400)
        expect(await iHovedliga('alice')).toBe(true)
    })
})

describe('/api/v1/hovedliga', () => {
    it('teller kun aktive hovedliga-deltakere i pott', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        await seedUser({ firebase_user_id: 'bob' })
        await seedUser({ firebase_user_id: 'opt-ut', i_hovedliga: false })
        await seedUser({ firebase_user_id: 'inaktiv', active: false })

        const body = await (await api('/api/v1/hovedliga', { user: 'alice' })).json()
        expect(body.pris).toBe(300)
        expect(body.antallDeltakere).toBe(2) // alice + bob; ikke opt-ut, ikke inaktiv
        expect(body.pott).toBe(600)
    })
})

describe('/api/v1/bets', () => {
    it('returnerer i_hovedliga per bruker', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'alice' })
        await seedUser({ firebase_user_id: 'opt-ut', name: 'opt-ut', i_hovedliga: false })

        const body = await (await api('/api/v1/bets', { user: 'alice' })).json()
        const alice = body.users.find((u: { name: string }) => u.name === 'alice')
        const optUt = body.users.find((u: { name: string }) => u.name === 'opt-ut')
        expect(alice.i_hovedliga).toBe(true)
        expect(optUt.i_hovedliga).toBe(false)
    })
})
