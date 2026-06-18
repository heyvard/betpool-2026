import https from 'https'
import { api, seedUser, truncateAll, withDb } from './helpers'

// Gyldige EC P-256-nøkler for et fiktivt push-abonnement.
// web-push krypterer payload med p256dh — verdiene må være kryptografisk gyldige.
const TEST_P256DH = 'BBIayXv_RVc9DpUA6Czj12WgzGSlqpyfv6USvak4qCmDXVyPu2CRLtaAGo5Nb1vN2L4UF0_yT8rfYvv6jNVZ2-Y'
const TEST_AUTH = 'G9MwECJXaomzQtpzRNWgLQ'

// Selvsignert sertifikat for 127.0.0.1. Nødvendig fordi web-push alltid bruker
// https.request — plain HTTP godtas ikke. Next.js-serveren kjøres med
// NODE_TLS_REJECT_UNAUTHORIZED=0 i testmiljøet slik at den aksepterer dette certet.
const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUcjxT6cGjoggojLXuFrL9FNqPXIkwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDYxNjA2MDkyNVoXDTM2MDYx
MzA2MDkyNVowFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAx3xFhUecLVmbgwB8FJYD6R6k6XmSWm8vo90be3NSvPF8
HmayVXX7WvyW4dDLczr88D4+gFD6ud09HMMislT6nIXAp32nDSfsvvq7D1876j1Z
Nl96jUJALgVc5s7VbWrYwGJekBns9GIF9/AK+9jI+dGddgvYCDOHbaQaLJP20OJP
GlSidTxG0C1w2Qf7VLWlCbQC7jDHr18lArUbiovLCxdEtz/p1fcI/+ESGrl65GUy
+V8JOOSzxmtnX/RqADRdeOHFFNyGbWDtj0Ihn11OzcO1Pecf9w3HK33pzc3GoCXO
LLd0ycaceN+OtDDeBmTQyCyGee58VPKuYRQV8WLdawIDAQABo1MwUTAdBgNVHQ4E
FgQU9XOR6zN55ZMel7fT85JLY8bGFmwwHwYDVR0jBBgwFoAU9XOR6zN55ZMel7fT
85JLY8bGFmwwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAoP9a
NnMH9yHxPal94FEZbjL60L2AOZtAgAAQFDN46rWfylWKg4cyaFgM4lH/Jc0lFT9m
xaeU3JOvw88/862xIU8XiK555VC4TI9her1TMigVQyju9XXbvYXvbggQugJ0aVsy
6APH79P3ejUkjP8q8ErJNsMgQCmPZTnAlBbqAOwRnvujL/TzXKe2DUVqjvAWWlpl
507+e7tT/H5syi84oUZoghfJpKSj95SjC6ivilpcSFtcBy4Bg4hXmYlHO+mtOM7W
CT6hBR0UuWg0r3ETFi+cbz5mYPSyTgyfDbKvcvtjEIy4gbRgtOIY8zYUsxDOGQxf
NZBMGmWcJxetNGZMMQ==
-----END CERTIFICATE-----`

const TEST_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDHfEWFR5wtWZuD
AHwUlgPpHqTpeZJaby+j3Rt7c1K88XweZrJVdfta/Jbh0MtzOvzwPj6AUPq53T0c
wyKyVPqchcCnfacNJ+y++rsPXzvqPVk2X3qNQkAuBVzmztVtatjAYl6QGez0YgX3
8Ar72Mj50Z12C9gIM4dtpBosk/bQ4k8aVKJ1PEbQLXDZB/tUtaUJtALuMMevXyUC
tRuKi8sLF0S3P+nV9wj/4RIauXrkZTL5Xwk45LPGa2df9GoANF144cUU3IZtYO2P
QiGfXU7Nw7U95x/3DccrfenNzcagJc4st3TJxpx43460MN4GZNDILIZ57nxU8q5h
FBXxYt1rAgMBAAECggEAO1u6IA+P5FqukIubYFDHNx3cOnDnYKuHBH5tiA1nyDsf
ELjERfPGaGuSxfzoHRCnZSFQXcQ65wVzAtT5xRDORbby/aPBCoQfyTA4azmOTYQV
wL0mbVQSXt9PpopTLazGdHCQ7NYaERn95qnxysDWBKgf75lUnhQfLzvOYgdhQQQf
uXMKgnvExmNxzSrtrspjFdS6cAlvsat+X07DwMkO9NCxxwafpBKpYvaTf76toSWu
2ICUP1uV3i5if5KBay8TIhxCtRr/xwpu1YsfZ0gF1Q46pIqlLd5h4v4igWZc5g/z
K1SJ/DPm6eNKaCBEVcZRHaIdmDFfR728FCcIGLUMwQKBgQDnTATaMUTK6/ThPBKq
IeTCGvVoEQzWHfIFTLjSPeT9CZeWiyNSGAQZlMiwrB9Ma+t5CGtZ43jiQS0l4UcM
2RlNTUOuFQMOG85FSukpCH0w+md4/EFjiOTxknBohBbpHLWjy+bdW2hTmfg1hlCK
p7AvBouteIHvZ7e/Zv/f16iGYQKBgQDcyntC3qhtMyCt9LgocPKZfovFiAlI/vx2
fImhMbQHC/CRwT+RoOgqJIkFmcoeTL5bbwXsHW83K4a8td2ECmOq2YNFzrDUJSw8
6QvO4L0NJxLh9+FJRNOgc+NwGNRBAFyaO/TfM+ZWPL/vhfq7ccjSzS1wyDOY2FFe
7hDY8BXfSwKBgFR4ILWGlLb+4Rl4lOBpLF/u9Hyi7Wss2Hwy/rRZQk1euWuTOLz8
ZFLrUTekRHHmX8J93qafOkB2yQQyd34rst/WPcdPiSQX54bKysfff8jpSeyXQ1IU
ZngKoN6qjqtnfrZo+tEQVtNhQZJakQNyJhemblBV2C4UVLij5wJaggNBAoGAETOt
Ws5iLO/Y0fTJDE2QeSkE1sT8hDVpkgmt52Mp9YqWmaSGwV/Z9r6V9lu/BZFRG2qQ
+Y5phdDcVIOO2KS+kycTNTMfT8f9pFk71EhqMkYjEHvxj3XPTyb4R1mH3/CZRmL5
dxJiFcHx6kVz/Xql/NaDfc/7RSNFY7IEmgJKkfUCgYBi1LcjLM8zoX25F67TRdOH
qvHXYZXXGwMmygT0O+f5ExUmHadE4rh7//XJXzx2d7QNElX2wM4O2Oxx8suHAgL6
RarOZKCswrrejbqRJDmwJDI5txR2/5mYZeBuQ0+QiOUN7O+AP3GdhziDJuZM69ou
3WdrYYvaMcOXCsOPMqhM8A==
-----END PRIVATE KEY-----`

// Lokal HTTPS push-mock som returnerer 410 (Gone). web-push behandler 410 som
// «abonnement utgått» og sletter raden fra push_subscriptions — det gjør det
// mulig å bekrefte at nøyaktig riktig brukers abonnement ble forsøkt.
let mockServer: https.Server
let mockPort: number

beforeAll(async () => {
    mockServer = https.createServer({ key: TEST_KEY, cert: TEST_CERT }, (_req, res) => {
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
            `https://127.0.0.1:${mockPort}${path}`,
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

describe('/api/v1/admin/send-push-alle — tilgangskontroll', () => {
    it('returnerer 401 uten innlogging', async () => {
        const res = await api('/api/v1/admin/send-push-alle', { method: 'POST' })
        expect(res.status).toBe(401)
    })

    it('returnerer 403 for vanlig bruker', async () => {
        await seedUser({ firebase_user_id: 'vanlig' })
        const res = await api('/api/v1/admin/send-push-alle', {
            user: 'vanlig',
            method: 'POST',
            body: { title: 'T', body: 'B' },
        })
        expect(res.status).toBe(403)
    })

    it('returnerer 405 for GET', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const res = await api('/api/v1/admin/send-push-alle', { user: 'super' })
        expect(res.status).toBe(405)
    })
})

describe('/api/v1/admin/send-push-alle — validering', () => {
    it('returnerer 400 når title mangler', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const res = await api('/api/v1/admin/send-push-alle', {
            user: 'super',
            method: 'POST',
            body: { body: 'B' },
        })
        expect(res.status).toBe(400)
    })

    it('returnerer 400 når body mangler', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const res = await api('/api/v1/admin/send-push-alle', {
            user: 'super',
            method: 'POST',
            body: { title: 'T' },
        })
        expect(res.status).toBe(400)
    })
})

describe('/api/v1/admin/send-push-alle — kringkasting', () => {
    it('sender til alle med generelle varsler på, men hopper over dem som har skrudd det av', async () => {
        await seedUser({ firebase_user_id: 'super', superadmin: true })
        const alice = await seedUser({ firebase_user_id: 'alice' })
        const bob = await seedUser({ firebase_user_id: 'bob' })
        const carol = await seedUser({ firebase_user_id: 'carol' })

        // Carol har skrudd av generelle varsler.
        await withDb((c) => c.query(`UPDATE users SET notif_general = false WHERE id = $1`, [carol.id]))

        await seedPushSub(alice.id, '/alice')
        await seedPushSub(bob.id, '/bob')
        await seedPushSub(carol.id, '/carol')

        const res = await api('/api/v1/admin/send-push-alle', {
            user: 'super',
            method: 'POST',
            body: { title: 'Siste sjanse', body: 'I dag lukker vinner og toppscorer.' },
        })
        expect(res.status).toBe(200)

        // Mock-serveren returnerer 410 → abonnementene det ble forsøkt sendt til
        // slettes. Alice og bob skal være forsøkt (slettet), carol skal stå urørt.
        expect(await abonnementTelling(alice.id)).toBe(0)
        expect(await abonnementTelling(bob.id)).toBe(0)
        expect(await abonnementTelling(carol.id)).toBe(1)
    })
})
