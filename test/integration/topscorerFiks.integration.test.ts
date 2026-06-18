import { api, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

async function seedSpiller(overrides: { id: number; name: string; team_tla: string }) {
    await withDb((c) =>
        c.query(`INSERT INTO players (id, name, team_tla) VALUES ($1, $2, $3)`, [
            overrides.id,
            overrides.name,
            overrides.team_tla,
        ]),
    )
}

async function hentTopscorerPlayerId(userId: string): Promise<number | null> {
    return withDb(async (c) => {
        const r = await c.query<{ topscorer_player_id: number | null }>(
            `SELECT topscorer_player_id FROM users WHERE id = $1`,
            [userId],
        )
        return r.rows[0].topscorer_player_id
    })
}

describe('/api/v1/admin/topscorer-fiks', () => {
    it('GET krever superadmin', async () => {
        await seedUser({ firebase_user_id: 'alice', scoreadmin: true })
        const res = await api('/api/v1/admin/topscorer-fiks', { user: 'alice' })
        expect(res.status).toBe(403)
    })

    it('GET lister aktive brukere med fritekst og oppslått spillernavn', async () => {
        await seedUser({ firebase_user_id: 'super', name: 'Super', superadmin: true, topscorer: null })
        const bob = await seedUser({ firebase_user_id: 'bob', name: 'Bob', topscorer: 'haaland' })
        await seedSpiller({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })
        await withDb((c) => c.query(`UPDATE users SET topscorer_player_id = 20 WHERE id = $1`, [bob.id]))

        const res = await api('/api/v1/admin/topscorer-fiks', { user: 'super' })
        expect(res.status).toBe(200)
        const brukere = await res.json()
        const bobRad = brukere.find((b: { name: string }) => b.name === 'Bob')
        expect(bobRad.topscorer).toBe('haaland')
        expect(bobRad.topscorer_player_id).toBe(20)
        expect(bobRad.player_name).toBe('Erling Haaland')
        expect(bobRad.player_team_tla).toBe('NOR')
    })

    it('PUT som superadmin kobler en bruker til en spiller', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const bob = await seedUser({ firebase_user_id: 'bob', topscorer: 'haaland' })
        await seedSpiller({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })

        const res = await api('/api/v1/admin/topscorer-fiks', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, playerId: 20 },
        })
        expect(res.status).toBe(200)
        expect(await hentTopscorerPlayerId(bob.id)).toBe(20)
    })

    it('PUT med playerId null nullstiller koblingen', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const bob = await seedUser({ firebase_user_id: 'bob' })
        await seedSpiller({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })
        await withDb((c) => c.query(`UPDATE users SET topscorer_player_id = 20 WHERE id = $1`, [bob.id]))

        const res = await api('/api/v1/admin/topscorer-fiks', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, playerId: null },
        })
        expect(res.status).toBe(200)
        expect(await hentTopscorerPlayerId(bob.id)).toBeNull()
    })

    it('PUT med ukjent spiller gir 400', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const bob = await seedUser({ firebase_user_id: 'bob' })

        const res = await api('/api/v1/admin/topscorer-fiks', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, playerId: 999 },
        })
        expect(res.status).toBe(400)
    })

    it('PUT krever superadmin', async () => {
        const bob = await seedUser({ firebase_user_id: 'bob', scoreadmin: true })
        await seedSpiller({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })

        const res = await api('/api/v1/admin/topscorer-fiks', {
            user: 'bob',
            method: 'PUT',
            body: { userId: bob.id, playerId: 20 },
        })
        expect(res.status).toBe(403)
    })
})
