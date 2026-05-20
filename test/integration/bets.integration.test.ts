import { api, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

describe('tipping', () => {
    it('PUT /api/v1/me/bets/[id] lagrer og upserter tips', async () => {
        await seedUser({ firebase_user_id: 'alice' })

        const first = await api('/api/v1/me/bets/1', {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 2, away_score: 1 },
        })
        expect(first.status).toBe(200)

        let rows = await withDb((c) => c.query('SELECT home_score, away_score FROM bets WHERE match_num = 1'))
        expect(rows.rows).toHaveLength(1)
        expect(rows.rows[0]).toMatchObject({ home_score: 2, away_score: 1 })

        // upsert — samme kamp igjen skal oppdatere, ikke lage ny rad
        await api('/api/v1/me/bets/1', { user: 'alice', method: 'PUT', body: { home_score: 3, away_score: 3 } })
        rows = await withDb((c) => c.query('SELECT home_score, away_score FROM bets WHERE match_num = 1'))
        expect(rows.rows).toHaveLength(1)
        expect(rows.rows[0]).toMatchObject({ home_score: 3, away_score: 3 })
    })

    it('PUT /api/v1/me/bets/[id] gir 404 for ukjent kamp', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/me/bets/99999', {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 1, away_score: 0 },
        })
        expect(res.status).toBe(404)
    })

    it('PUT /api/v1/me/bets/[id] gir 400 for ugyldig match_num', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/me/bets/abc', {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 1, away_score: 0 },
        })
        expect(res.status).toBe(400)
    })

    it('PUT /api/v1/me/bets/[id] gir 400 når en score mangler', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/me/bets/1', {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 2, away_score: null },
        })
        expect(res.status).toBe(400)

        const rows = await withDb((c) => c.query('SELECT * FROM bets WHERE match_num = 1'))
        expect(rows.rows).toHaveLength(0)
    })

    it('GET /api/v1/me/bets returnerer egne tip per kamp', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        await api('/api/v1/me/bets/1', { user: 'alice', method: 'PUT', body: { home_score: 2, away_score: 1 } })

        const res = await api('/api/v1/me/bets', { user: 'alice' })
        expect(res.status).toBe(200)
        const bets = await res.json()
        const kamp1 = bets.find((b: { match_num: number }) => b.match_num === 1)
        expect(kamp1).toMatchObject({ home_score: 2, away_score: 1 })
    })

    it('GET /api/v1/bets returnerer { bets, users }', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await seedUser({ firebase_user_id: 'bob', name: 'Bob' })

        const res = await api('/api/v1/bets', { user: 'alice' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body.bets)).toBe(true)
        expect(body.users.map((u: { name: string }) => u.name).sort()).toEqual(['Alice', 'Bob'])
    })
})
