import { api, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

describe('/api/v1/users', () => {
    it('GET krever superadmin/scoreadmin', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/users', { user: 'alice' })
        expect(res.status).toBe(403)
    })

    it('GET som superadmin returnerer alle brukere', async () => {
        await seedUser({ firebase_user_id: 'super', name: 'Super', superadmin: true })
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const res = await api('/api/v1/users', { user: 'super' })
        expect(res.status).toBe(200)
        const users = await res.json()
        expect(users.map((u: { name: string }) => u.name).sort()).toEqual(['Alice', 'Super'])
    })

    it('GET teller push-enheter og viser varselinnstillinger', async () => {
        await seedUser({ firebase_user_id: 'super', name: 'Super', superadmin: true })
        const alice = await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        await withDb((c) =>
            c.query(
                `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES
                   ($1, 'https://push.example/1', 'k1', 'a1'),
                   ($1, 'https://push.example/2', 'k2', 'a2')`,
                [alice.id],
            ),
        )

        const res = await api('/api/v1/users', { user: 'super' })
        expect(res.status).toBe(200)
        const users = await res.json()
        const aliceRad = users.find((u: { name: string }) => u.name === 'Alice')
        const superRad = users.find((u: { name: string }) => u.name === 'Super')

        expect(aliceRad.device_count).toBe(2)
        expect(superRad.device_count).toBe(0)
        // Varselinnstillinger har default true ved opprettelse.
        expect(aliceRad.notif_general).toBe(true)
        expect(aliceRad.notif_reminders).toBe(true)
        expect(aliceRad.notif_summary).toBe(true)
    })

    it('PUT /api/v1/users/[id] kan markere betalt', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const target = await seedUser({ firebase_user_id: 'alice', paid: false })

        const res = await api(`/api/v1/users/${target.id}`, {
            user: 'super',
            method: 'PUT',
            body: { paid: true },
        })
        expect(res.status).toBe(200)

        const row = await withDb((c) => c.query('SELECT paid FROM users WHERE id = $1', [target.id]))
        expect(row.rows[0].paid).toBe(true)
    })

    it('PUT /api/v1/users/[id] — superadmin kan gi scoreadmin', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const target = await seedUser({ firebase_user_id: 'alice', scoreadmin: false })

        await api(`/api/v1/users/${target.id}`, {
            user: 'super',
            method: 'PUT',
            body: { scoreadmin: true },
        })

        const row = await withDb((c) => c.query('SELECT scoreadmin FROM users WHERE id = $1', [target.id]))
        expect(row.rows[0].scoreadmin).toBe(true)
    })
})
