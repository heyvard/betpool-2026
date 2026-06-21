import { api, seedUser, truncateAll, withDb } from './helpers'

beforeEach(truncateAll)

// Oppretter en feed-post direkte i DB-et og returnerer id-en.
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

async function antallPoster(): Promise<number> {
    return withDb(async (c) => {
        const r = await c.query<{ n: string }>(`SELECT count(*) AS n FROM feed_posts`)
        return parseInt(r.rows[0].n, 10)
    })
}

describe('DELETE /api/v1/feed/:postId', () => {
    it('superadmin kan slette en post', async () => {
        await seedUser({ firebase_user_id: 'admin', name: 'Admin', superadmin: true })
        const postId = await seedFeedPost()

        const res = await api(`/api/v1/feed/${postId}`, { user: 'admin', method: 'DELETE' })
        expect(res.status).toBe(200)
        expect(await antallPoster()).toBe(0)
    })

    it('sletter også reaksjoner og kommentarer (cascade)', async () => {
        const admin = await seedUser({ firebase_user_id: 'admin', name: 'Admin', superadmin: true })
        const postId = await seedFeedPost()
        await withDb(async (c) => {
            await c.query(`INSERT INTO feed_reactions (post_id, user_id, emoji) VALUES ($1, $2, '👍')`, [
                postId,
                admin.id,
            ])
            await c.query(`INSERT INTO feed_comments (post_id, user_id, body) VALUES ($1, $2, 'Hei')`, [
                postId,
                admin.id,
            ])
        })

        const res = await api(`/api/v1/feed/${postId}`, { user: 'admin', method: 'DELETE' })
        expect(res.status).toBe(200)

        const rester = await withDb(async (c) => {
            const r = await c.query<{ n: string }>(`SELECT count(*) AS n FROM feed_reactions`)
            const k = await c.query<{ n: string }>(`SELECT count(*) AS n FROM feed_comments`)
            return { reaksjoner: parseInt(r.rows[0].n, 10), kommentarer: parseInt(k.rows[0].n, 10) }
        })
        expect(rester.reaksjoner).toBe(0)
        expect(rester.kommentarer).toBe(0)
    })

    it('vanlig bruker får 403', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        const postId = await seedFeedPost()

        const res = await api(`/api/v1/feed/${postId}`, { user: 'alice', method: 'DELETE' })
        expect(res.status).toBe(403)
        expect(await antallPoster()).toBe(1)
    })

    it('gir 404 når posten ikke finnes', async () => {
        await seedUser({ firebase_user_id: 'admin', name: 'Admin', superadmin: true })

        const res = await api(`/api/v1/feed/00000000-0000-0000-0000-000000000000`, {
            user: 'admin',
            method: 'DELETE',
        })
        expect(res.status).toBe(404)
    })
})
