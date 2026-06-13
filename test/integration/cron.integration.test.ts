import { api, truncateAll, seedUser } from './helpers'

const CRON_SECRET = 'test-cron-secret'

function baseUrl() {
    return process.env.TEST_BASE_URL ?? 'http://localhost:3100'
}

async function cronPost(path: string, secret?: string): Promise<Response> {
    const headers: Record<string, string> = {}
    if (secret !== undefined) headers['Authorization'] = `Bearer ${secret}`
    return fetch(`${baseUrl()}${path}`, { method: 'POST', headers })
}

beforeEach(truncateAll)

describe('/api/cron/* — autentisering', () => {
    const cronRuter = ['/api/cron/sync-matches', '/api/cron/sync-scores', '/api/cron/send-reminders']

    it.each(cronRuter)('%s returnerer 401 uten Authorization-header', async (path) => {
        const res = await cronPost(path)
        expect(res.status).toBe(401)
    })

    it.each(cronRuter)('%s returnerer 401 med feil secret', async (path) => {
        const res = await cronPost(path, 'feil-secret')
        expect(res.status).toBe(401)
    })
})

describe('/api/cron/send-reminders — kjøring', () => {
    it('returnerer 200 med resultatstruktur ved riktig secret', async () => {
        // Ingen brukere i DB → ingen varsler sendes → ingen VAPID-kall
        const res = await cronPost('/api/cron/send-reminders', CRON_SECRET)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('kamperIMorgen')
        expect(body).toHaveProperty('brukereVarslet')
        expect(body.brukereVarslet).toBe(0)
    })

    it('varsler ikke brukere uten notif_reminders', async () => {
        await seedUser({ firebase_user_id: 'bruker', notif_reminders: false })
        const res = await cronPost('/api/cron/send-reminders', CRON_SECRET)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.brukereVarslet).toBe(0)
    })
})

describe('/api/v1/admin/cron/* — tilgangskontroll', () => {
    const adminRuter = [
        '/api/v1/admin/cron/sync-matches',
        '/api/v1/admin/cron/sync-scores',
        '/api/v1/admin/cron/sync-standings',
        '/api/v1/admin/cron/send-reminders',
    ]

    it.each(adminRuter)('%s returnerer 401 uten innlogging', async (path) => {
        const res = await api(path, { method: 'POST' })
        expect(res.status).toBe(401)
    })

    it.each(adminRuter)('%s returnerer 403 for vanlig bruker', async (path) => {
        await seedUser({ firebase_user_id: 'vanlig', superadmin: false })
        const res = await api(path, { user: 'vanlig', method: 'POST' })
        expect(res.status).toBe(403)
    })
})

describe('/api/v1/admin/cron/send-reminders — kjøring', () => {
    it('returnerer 200 med resultatstruktur for superadmin', async () => {
        await seedUser({ firebase_user_id: 'admin', superadmin: true, notif_reminders: false })
        const res = await api('/api/v1/admin/cron/send-reminders', { user: 'admin', method: 'POST' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('kamperIMorgen')
        expect(body).toHaveProperty('brukereVarslet')
        expect(body.brukereVarslet).toBe(0)
    })
})
