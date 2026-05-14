import { api, truncateAll } from './helpers'

beforeEach(truncateAll)

describe('test-auth', () => {
    it('gir 401 uten x-test-user', async () => {
        const res = await api('/api/v1/matches')
        expect(res.status).toBe(401)
    })

    it('gir 401 for ukjent bruker (ingen rad i DB)', async () => {
        const res = await api('/api/v1/matches', { user: 'finnes-ikke' })
        expect(res.status).toBe(401)
    })

    it('aksepterer identitet via betpool_test_user-cookie', async () => {
        // 'me' oppretter brukeren automatisk når den ikke finnes
        const res = await api('/api/v1/me', { cookieUser: 'cookie-bruker' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.firebase_user_id).toBe('cookie-bruker')
    })
})
