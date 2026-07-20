import { api, seedUser, truncateAll } from './helpers'

beforeEach(truncateAll)

describe('/api/v1/hovedliga', () => {
    it('teller kun aktive brukere i pott', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        await seedUser({ firebase_user_id: 'bob' })
        await seedUser({ firebase_user_id: 'inaktiv', active: false })

        const body = await (await api('/api/v1/hovedliga', { user: 'alice' })).json()
        expect(body.pris).toBe(300)
        expect(body.antallDeltakere).toBe(2) // alice + bob; ikke inaktiv
        expect(body.pott).toBe(600)
    })
})
