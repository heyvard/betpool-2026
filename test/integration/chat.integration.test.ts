import { api, seedUser, truncateAll } from './helpers'

beforeEach(truncateAll)

describe('/api/v1/chat', () => {
    it('POST lagrer melding og GET henter den med brukernavn', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const post = await api('/api/v1/chat', {
            user: 'alice',
            method: 'POST',
            body: { message: 'heia Norge' },
        })
        expect(post.status).toBe(201)

        const res = await api('/api/v1/chat', { user: 'alice' })
        expect(res.status).toBe(200)
        const chat = await res.json()
        expect(chat).toHaveLength(1)
        expect(chat[0]).toMatchObject({ message: 'heia Norge', name: 'Alice' })
    })
})
