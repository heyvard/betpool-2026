import { api, førsteMatchNum, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

describe('/api/v1/matches', () => {
    it('GET returnerer kampene fra datasettet', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/matches', { user: 'alice' })
        expect(res.status).toBe(200)
        const matches = await res.json()
        expect(matches.length).toBeGreaterThan(0)
        expect(matches[0]).toHaveProperty('match_num')
    })

    it('PUT /api/v1/matches/[id] krever scoreadmin', async () => {
        await seedUser({ firebase_user_id: 'alice', scoreadmin: false })
        const matchNum = await førsteMatchNum()
        const res = await api(`/api/v1/matches/${matchNum}`, {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 1, away_score: 0 },
        })
        expect(res.status).toBe(403)
    })

    it('scoreadmin kan sette resultat, og det vises i GET', async () => {
        await seedUser({ firebase_user_id: 'admin', scoreadmin: true })
        const matchNum = await førsteMatchNum()
        const put = await api(`/api/v1/matches/${matchNum}`, {
            user: 'admin',
            method: 'PUT',
            body: { home_score: 3, away_score: 1 },
        })
        expect(put.status).toBe(200)

        const dbRow = await withDb((c) =>
            c.query('SELECT home_score, away_score FROM match_scores WHERE match_num = $1', [matchNum]),
        )
        expect(dbRow.rows[0]).toMatchObject({ home_score: 3, away_score: 1 })

        const matches = await (await api('/api/v1/matches', { user: 'admin' })).json()
        const kamp1 = matches.find((m: { match_num: number }) => m.match_num === matchNum)
        expect(kamp1).toMatchObject({ home_score: 3, away_score: 1 })
    })

    it('scoreadmin kan overstyre lagnavn', async () => {
        await seedUser({ firebase_user_id: 'admin', scoreadmin: true })
        const matchNum = await førsteMatchNum()
        await api(`/api/v1/matches/${matchNum}`, { user: 'admin', method: 'PUT', body: { home_team: 'NOR' } })

        const matches = await (await api('/api/v1/matches', { user: 'admin' })).json()
        const kamp1 = matches.find((m: { match_num: number }) => m.match_num === matchNum)
        expect(kamp1.home_team).toBe('NOR')
    })
})
