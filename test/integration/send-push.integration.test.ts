import http from 'http'
import { api, seedUser, truncateAll, withDb } from './helpers'

// Gyldige EC P-256-nøkler for et fiktivt push-abonnement.
// web-push krypterer payload med p256dh — verdiene må være kryptografisk gyldige.
const TEST_P256DH = 'BBIayXv_RVc9DpUA6Czj12WgzGSlqpyfv6USvak4qCmDXVyPu2CRLtaAGo5Nb1vN2L4UF0_yT8rfYvv6jNVZ2-Y'
const TEST_AUTH = 'G9MwECJXaomzQtpzRNWgLQ'

// Lokal push-mock som returnerer 410 (Gone). web-push behandler 410 som
// «abonnement utgått» og triggerpushen til å slette raden fra push_subscriptions.
// Det gjør det mulig å bekrefte at nøyaktig riktig brukers abonnement ble forsøkt.
let mockServer: http.Server
let mockPort: number

beforeAll(async () => {
    mockServer = http.createServer((_req, res) => {
        res.writeHead(410)
        res.end()
    })
    await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', resolve))
    mockPort = (mockServer.address() as { port: number }).port
})

afterAll(() => new Promise<void>((resolve, reject) => mockServer.close((err) => (err ? reject(err) : resolve()))))

beforeEach(truncateAll)

async function seedPushSub(userId: string, path: string): Promise<void> {
    await withDb((c) =>
        c.query(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)`, [
            userId,
            `http://127.0.0.1:${mockPort}${path}`,
            TEST_P256DH,
            TEST_AUTH,
        ]),
    )
}

async function abonnementTelling(userId: string): Promise<number> {
    const r = await withDb((c) =>
        c.query<{ count: string }>('SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = $1', [userId]),
    )
    return Number(r.rows[0].count)
}

describe('/api/v1/admin/send-push — tilgangskontroll', () => {
    it('returnerer 401 uten innlogging', async () => {
        const res = await api('/api/v1/admin/send-push', { method: 'POST' })
        expect(res.status).toBe(401)
    })

    it('returnerer 403 for vanlig bruker', async () => {
        await seedUser({ firebase_user_id: 'vanlig' })
        const res = await api('/api/v1/admin/send-push', {
            user: 'vanlig',
            method: 'POST',
            body: { userId: 'xxx', title: 'T', body: 'B' },
        })
        expect(res.status).toBe(403)
    })

    it('returnerer 405 for GET', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const res = await api('/api/v1/admin/send-push', { user: 'super' })
        expect(res.status).toBe(405)
    })
})

describe('/api/v1/admin/send-push — validering', () => {
    it('returnerer 400 når userId mangler', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const res = await api('/api/v1/admin/send-push', {
            user: 'super',
            method: 'POST',
            body: { title: 'T', body: 'B' },
        })
        expect(res.status).toBe(400)
    })

    it('returnerer 400 når title mangler', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const alice = await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/admin/send-push', {
            user: 'super',
            method: 'POST',
            body: { userId: alice.id, body: 'B' },
        })
        expect(res.status).toBe(400)
    })

    it('returnerer 400 når body mangler', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const alice = await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/admin/send-push', {
            user: 'super',
            method: 'POST',
            body: { userId: alice.id, title: 'T' },
        })
        expect(res.status).toBe(400)
    })

    it('returnerer 400 for title som bare er whitespace', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const alice = await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/admin/send-push', {
            user: 'super',
            method: 'POST',
            body: { userId: alice.id, title: '   ', body: 'B' },
        })
        expect(res.status).toBe(400)
    })
})

describe('/api/v1/admin/send-push — sending', () => {
    it('returnerer { sendt: 0 } for bruker uten push-abonnement', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const alice = await seedUser({ firebase_user_id: 'alice' })

        const res = await api('/api/v1/admin/send-push', {
            user: 'super',
            method: 'POST',
            body: { userId: alice.id, title: 'Hei', body: 'Melding' },
        })
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ sendt: 0 })
    })

    it('sender bare til abonnementene til den angitte brukeren', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const alice = await seedUser({ firebase_user_id: 'alice' })
        const bob = await seedUser({ firebase_user_id: 'bob' })

        await seedPushSub(alice.id, '/alice')
        await seedPushSub(bob.id, '/bob')

        const res = await api('/api/v1/admin/send-push', {
            user: 'super',
            method: 'POST',
            body: { userId: alice.id, title: 'Hei', body: 'Melding' },
        })
        expect(res.status).toBe(200)

        // Mock-serveren returnerer 410 → push-koden sletter alice sitt abonnement.
        // Dersom koden hadde sendt til feil bruker, ville alice sitt abonnement
        // fortsatt eksistert og bob sitt vært slettet.
        expect(await abonnementTelling(alice.id)).toBe(0)
        expect(await abonnementTelling(bob.id)).toBe(1)
    })
})
