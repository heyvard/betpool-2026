import { api, førsteMatchNum, seedSyncedKnockoutScore, seedUser, setMatchStatus, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

describe('/api/v1/matches', () => {
    it('GET returnerer kampene fra datasettet', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/matches', { user: 'alice' })
        expect(res.status).toBe(200)
        const matches = await res.json()
        expect(matches.length).toBeGreaterThan(0)
        expect(matches[0]).toHaveProperty('match_num')
        expect(matches[0]).toHaveProperty('status')
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

    it('sluttspillkamp avgjort på straffer: aktivt resultat er ordinær tid, ikke totalen', async () => {
        await seedUser({ firebase_user_id: 'admin', scoreadmin: true })
        const matchNum = await førsteMatchNum()
        await setMatchStatus(matchNum, 'FINISHED')
        // 1–1 etter ordinær tid, borte vant 5–3 på straffer (fullTime-totalen blir 4–6)
        await seedSyncedKnockoutScore({
            matchNum,
            ftHome: 4,
            ftAway: 6,
            rtHome: 1,
            rtAway: 1,
            etHome: 0,
            etAway: 0,
            penHome: 3,
            penAway: 5,
            duration: 'PENALTY_SHOOTOUT',
            winner: 'AWAY_TEAM',
        })

        const matches = await (await api('/api/v1/matches', { user: 'admin' })).json()
        const kamp = matches.find((m: { match_num: number }) => m.match_num === matchNum)
        // Tippe-resultatet er ordinær tid (1–1), ikke fulltids-totalen (4–6)
        expect(kamp).toMatchObject({ home_score: 1, away_score: 1 })
        // scoreadmin får detaljene for å vise straffe-/videre-info
        expect(kamp.adminData).toMatchObject({
            synced_home_rt: 1,
            synced_away_rt: 1,
            synced_home_pen: 3,
            synced_away_pen: 5,
            synced_duration: 'PENALTY_SHOOTOUT',
            synced_winner: 'AWAY_TEAM',
        })
    })
})
