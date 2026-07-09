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

async function hentBruker(userId: string) {
    return withDb(async (c) => {
        const r = await c.query<{
            winner: string
            winner_endret: boolean
            topscorer_player_id: number | null
            topscorer_endret: boolean
        }>(`SELECT winner, winner_endret, topscorer_player_id, topscorer_endret FROM users WHERE id = $1`, [userId])
        return r.rows[0]
    })
}

describe('/api/v1/admin/manglende-tips', () => {
    it('GET krever superadmin', async () => {
        await seedUser({ firebase_user_id: 'alice', scoreadmin: true })
        const res = await api('/api/v1/admin/manglende-tips', { user: 'alice' })
        expect(res.status).toBe(403)
    })

    it('GET lister aktive brukere med vinner/toppscorer-status', async () => {
        await seedUser({ firebase_user_id: 'super', name: 'Super', superadmin: true })
        await seedUser({ firebase_user_id: 'bob', name: 'Bob', winner: 'BRA' })
        await seedSpiller({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })

        const res = await api('/api/v1/admin/manglende-tips', { user: 'super' })
        expect(res.status).toBe(200)
        const brukere = await res.json()
        const bobRad = brukere.find((b: { name: string }) => b.name === 'Bob')
        expect(bobRad.winner).toBe('BRA')
        expect(bobRad.winner_endret).toBe(false)
        expect(bobRad.topscorer_player_id).toBeNull()
    })

    it('PUT setter vinner og winner_endret for en bruker som mangler tips', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const bob = await seedUser({ firebase_user_id: 'bob' })

        const res = await api('/api/v1/admin/manglende-tips', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, winner: 'BRA' },
        })
        expect(res.status).toBe(200)
        const rad = await hentBruker(bob.id)
        expect(rad.winner).toBe('BRA')
        expect(rad.winner_endret).toBe(true)
    })

    it('PUT setter toppscorer og topscorer_endret for en bruker som mangler tips', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const bob = await seedUser({ firebase_user_id: 'bob' })
        await seedSpiller({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })

        const res = await api('/api/v1/admin/manglende-tips', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, topscorerPlayerId: 20 },
        })
        expect(res.status).toBe(200)
        const rad = await hentBruker(bob.id)
        expect(rad.topscorer_player_id).toBe(20)
        expect(rad.topscorer_endret).toBe(true)
    })

    it('PUT avvises med 400 hvis brukeren allerede har satt vinner', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const bob = await seedUser({ firebase_user_id: 'bob', winner: 'BRA' })

        const res = await api('/api/v1/admin/manglende-tips', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, winner: 'ARG' },
        })
        expect(res.status).toBe(400)
        const rad = await hentBruker(bob.id)
        expect(rad.winner).toBe('BRA')
        expect(rad.winner_endret).toBe(false)
    })

    it('PUT avvises med 400 hvis brukeren allerede har satt toppscorer', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        await seedSpiller({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })
        await seedSpiller({ id: 21, name: 'Kylian Mbappé', team_tla: 'FRA' })
        const bob = await seedUser({ firebase_user_id: 'bob', topscorer_player_id: 20 })

        const res = await api('/api/v1/admin/manglende-tips', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, topscorerPlayerId: 21 },
        })
        expect(res.status).toBe(400)
        const rad = await hentBruker(bob.id)
        expect(rad.topscorer_player_id).toBe(20)
        expect(rad.topscorer_endret).toBe(false)
    })

    it('PUT med ukjent spiller gir 400', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const bob = await seedUser({ firebase_user_id: 'bob' })

        const res = await api('/api/v1/admin/manglende-tips', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, topscorerPlayerId: 999 },
        })
        expect(res.status).toBe(400)
    })

    it('PUT med ukjent landskode gir 400', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const bob = await seedUser({ firebase_user_id: 'bob' })

        const res = await api('/api/v1/admin/manglende-tips', {
            user: 'super',
            method: 'PUT',
            body: { userId: bob.id, winner: 'XXX' },
        })
        expect(res.status).toBe(400)
    })

    it('PUT krever superadmin', async () => {
        const bob = await seedUser({ firebase_user_id: 'bob', scoreadmin: true })

        const res = await api('/api/v1/admin/manglende-tips', {
            user: 'bob',
            method: 'PUT',
            body: { userId: bob.id, winner: 'BRA' },
        })
        expect(res.status).toBe(403)
    })
})
