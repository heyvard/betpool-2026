import { api, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

async function seedFeedPost(): Promise<string> {
    return withDb(async (c) => {
        const r = await c.query<{ id: string }>(
            `INSERT INTO feed_posts (kind, scenario, accent, tittel, body)
             VALUES ('morgenrapport', 'endring', 'gold', 'Tittel', 'Body')
             RETURNING id`,
        )
        return r.rows[0].id
    })
}

describe('GET /api/v1/admin/feed-export', () => {
    it('superadmin får feed + leaderboard-metadata', async () => {
        await seedUser({ firebase_user_id: 'admin', name: 'Admin', superadmin: true })
        await seedFeedPost()

        const res = await api('/api/v1/admin/feed-export', { user: 'admin', method: 'GET' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body.posts)).toBe(true)
        expect(body.posts.length).toBe(1)
        expect(Array.isArray(body.metadata.leaderboard)).toBe(true)
        expect(typeof body.metadata.generertAt).toBe('string')
    })

    it('vanlig bruker får 403', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const res = await api('/api/v1/admin/feed-export', { user: 'alice', method: 'GET' })
        expect(res.status).toBe(403)
    })
})
