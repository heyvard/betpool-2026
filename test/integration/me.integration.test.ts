import { api, seedUser, seedPlayer, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

describe('/api/v1/me', () => {
    it('oppretter ny bruker ved første kall', async () => {
        const res = await api('/api/v1/me', { user: 'nybrukeren' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.firebase_user_id).toBe('nybrukeren')
        expect(body.email).toBe('nybrukeren@test.local')

        const count = await withDb((c) =>
            c.query('SELECT count(*)::int AS n FROM users WHERE firebase_user_id = $1', ['nybrukeren']),
        )
        expect(count.rows[0].n).toBe(1)
    })

    it('henter eksisterende bruker uten å lage ny rad', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await api('/api/v1/me', { user: 'alice' })
        const res = await api('/api/v1/me', { user: 'alice' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe('Alice')

        const count = await withDb((c) =>
            c.query('SELECT count(*)::int AS n FROM users WHERE firebase_user_id = $1', ['alice']),
        )
        expect(count.rows[0].n).toBe(1)
    })

    it('PUT oppdaterer winner', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        // Vinner kan kun settes i første runde-vinduet (før 2. gruppespillsrunde).
        // Pinn klokka til før VM, ellers avvises oppdateringen når testen kjøres
        // etter at vinduet faktisk har stengt (jf. erIFørsteRundeMed).
        const put = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { winner: 'Brazil' },
            clock: '2026-06-01T12:00:00Z',
        })
        expect(put.status).toBe(200)

        const me = await (await api('/api/v1/me', { user: 'alice' })).json()
        expect(me.winner).toBe('Brazil')
    })

    it('PUT setter strukturert topscorer_player_id i første runde', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await seedPlayer({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })

        const put = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { topscorerPlayerId: 20 },
            clock: '2026-06-01T12:00:00Z',
        })
        expect(put.status).toBe(200)

        const me = await (await api('/api/v1/me', { user: 'alice' })).json()
        expect(me.topscorer_player_id).toBe(20)
    })

    it('PUT med ukjent topscorerPlayerId gir 400', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const put = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { topscorerPlayerId: 999 },
            clock: '2026-06-01T12:00:00Z',
        })
        expect(put.status).toBe(400)
    })
})
