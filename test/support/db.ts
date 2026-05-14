import { Client } from 'pg'

// Direkte DB-tilgang mot test-containeren — for seeding og asserts.
// Brukes av både jest-integrasjonstestene og Playwright-e2e.

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: process.env.TEST_DB_URL })
    await client.connect()
    try {
        return await fn(client)
    } finally {
        await client.end()
    }
}

export async function truncateAll(): Promise<void> {
    await withDb((c) => c.query('TRUNCATE users, bets, chat, match_scores CASCADE'))
}

export interface SeedUser {
    firebase_user_id: string
    name: string
    email: string
    picture: string | null
    active: boolean
    scoreadmin: boolean
    paymentadmin: boolean
    superadmin: boolean
    paid: boolean
    winner: string
    topscorer: string | null
}

export async function seedUser(overrides: Partial<SeedUser> = {}): Promise<SeedUser & { id: string }> {
    const fid = overrides.firebase_user_id ?? `user-${Math.random().toString(36).slice(2, 8)}`
    const u: SeedUser = {
        firebase_user_id: fid,
        name: overrides.name ?? fid,
        email: overrides.email ?? `${fid}@test.local`,
        picture: overrides.picture ?? null,
        active: overrides.active ?? true,
        scoreadmin: overrides.scoreadmin ?? false,
        paymentadmin: overrides.paymentadmin ?? false,
        superadmin: overrides.superadmin ?? false,
        paid: overrides.paid ?? false,
        winner: overrides.winner ?? '',
        topscorer: overrides.topscorer ?? null,
    }
    return withDb(async (c) => {
        const r = await c.query(
            `INSERT INTO users
               (firebase_user_id, name, email, picture, active, scoreadmin, paymentadmin, superadmin, paid, winner, topscorer)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [
                u.firebase_user_id,
                u.name,
                u.email,
                u.picture,
                u.active,
                u.scoreadmin,
                u.paymentadmin,
                u.superadmin,
                u.paid,
                u.winner,
                u.topscorer,
            ],
        )
        return r.rows[0]
    })
}
