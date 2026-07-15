import { api, seedPlayer, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

async function hentFasit() {
    return withDb(async (c) => {
        const vinner = await c.query<{ winner_team_tla: string | null }>(
            `SELECT winner_team_tla FROM tournament_result WHERE id = 'current'`,
        )
        const spillere = await c.query<{ player_id: number }>(
            `SELECT player_id FROM tournament_topscorers ORDER BY player_id`,
        )
        return {
            winnerTeam: vinner.rows[0]?.winner_team_tla ?? null,
            topscorerPlayerIds: spillere.rows.map((r) => r.player_id),
        }
    })
}

describe('/api/v1/admin/tournament-result', () => {
    it('GET krever superadmin', async () => {
        await seedUser({ firebase_user_id: 'alice', scoreadmin: true })
        const res = await api('/api/v1/admin/tournament-result', { user: 'alice' })
        expect(res.status).toBe(403)
    })

    it('GET returnerer tom fasit før noe er satt', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const res = await api('/api/v1/admin/tournament-result', { user: 'super' })
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ winnerTeam: '', topscorerPlayerIds: [] })
    })

    it('PUT som superadmin setter vinner og flere toppscorere', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        await seedPlayer({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })
        await seedPlayer({ id: 21, name: 'Kylian Mbappé', team_tla: 'FRA' })

        const putRes = await api('/api/v1/admin/tournament-result', {
            user: 'super',
            method: 'PUT',
            body: { winnerTeam: 'FRA', topscorerPlayerIds: [20, 21] },
        })
        expect(putRes.status).toBe(200)

        const getRes = await api('/api/v1/admin/tournament-result', { user: 'super' })
        const fasit = await getRes.json()
        expect(fasit.winnerTeam).toBe('FRA')
        expect(fasit.topscorerPlayerIds.sort()).toEqual([20, 21])
    })

    it('PUT med ukjent lag gir 400', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })

        const res = await api('/api/v1/admin/tournament-result', {
            user: 'super',
            method: 'PUT',
            body: { winnerTeam: 'XXX', topscorerPlayerIds: [] },
        })
        expect(res.status).toBe(400)
    })

    it('PUT med ukjent spiller gir 400', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })

        const res = await api('/api/v1/admin/tournament-result', {
            user: 'super',
            method: 'PUT',
            body: { winnerTeam: null, topscorerPlayerIds: [999] },
        })
        expect(res.status).toBe(400)
    })

    it('PUT med tom liste nullstiller tidligere satte toppscorere', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        await seedPlayer({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })

        await api('/api/v1/admin/tournament-result', {
            user: 'super',
            method: 'PUT',
            body: { winnerTeam: 'NOR', topscorerPlayerIds: [20] },
        })
        expect((await hentFasit()).topscorerPlayerIds).toEqual([20])

        const res = await api('/api/v1/admin/tournament-result', {
            user: 'super',
            method: 'PUT',
            body: { winnerTeam: null, topscorerPlayerIds: [] },
        })
        expect(res.status).toBe(200)
        const fasit = await hentFasit()
        expect(fasit.winnerTeam).toBeNull()
        expect(fasit.topscorerPlayerIds).toEqual([])
    })

    it('PUT krever superadmin', async () => {
        await seedUser({ firebase_user_id: 'bob', scoreadmin: true })

        const res = await api('/api/v1/admin/tournament-result', {
            user: 'bob',
            method: 'PUT',
            body: { winnerTeam: 'NOR', topscorerPlayerIds: [] },
        })
        expect(res.status).toBe(403)
    })
})
