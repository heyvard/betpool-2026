import { api, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

async function seedSpiller(overrides: { id: number; name: string; team_tla: string; shirt_number?: number | null }) {
    await withDb((c) =>
        c.query(
            `INSERT INTO players (id, name, team_tla, shirt_number)
             VALUES ($1, $2, $3, $4)`,
            [overrides.id, overrides.name, overrides.team_tla, overrides.shirt_number ?? null],
        ),
    )
}

describe('/api/v1/admin/players', () => {
    it('GET krever superadmin', async () => {
        await seedUser({ firebase_user_id: 'alice', scoreadmin: true })
        const res = await api('/api/v1/admin/players', { user: 'alice' })
        expect(res.status).toBe(403)
    })

    it('GET som superadmin lister spillerne sortert per landslag og draktnummer', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        await seedSpiller({ id: 10, name: 'Bukayo Saka', team_tla: 'ENG', shirt_number: 7 })
        await seedSpiller({ id: 11, name: 'Harry Kane', team_tla: 'ENG', shirt_number: 9 })
        await seedSpiller({ id: 20, name: 'Erling Haaland', team_tla: 'NOR', shirt_number: 9 })

        const res = await api('/api/v1/admin/players', { user: 'super' })
        expect(res.status).toBe(200)
        const spillere = await res.json()
        expect(spillere.map((s: { name: string }) => s.name)).toEqual(['Bukayo Saka', 'Harry Kane', 'Erling Haaland'])
    })
})
