import { api, seedUser, truncateAll } from './helpers'

beforeEach(truncateAll)

describe('/api/v1/feedback', () => {
    it('lar en vanlig bruker sende tilbakemelding', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const post = await api('/api/v1/feedback', {
            user: 'alice',
            method: 'POST',
            body: { message: 'Flott app!' },
        })
        expect(post.status).toBe(201)
    })

    it('avviser tom melding', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const post = await api('/api/v1/feedback', {
            user: 'alice',
            method: 'POST',
            body: { message: '   ' },
        })
        expect(post.status).toBe(400)
    })

    it('superadmin ser innsendte tilbakemeldinger', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await seedUser({ firebase_user_id: 'admin', name: 'Admin', superadmin: true })

        await api('/api/v1/feedback', { user: 'alice', method: 'POST', body: { message: 'Hei fra Alice' } })

        const list = await (await api('/api/v1/feedback', { user: 'admin' })).json()
        expect(list).toHaveLength(1)
        expect(list[0].message).toBe('Hei fra Alice')
        expect(list[0].name).toBe('Alice')
        expect(list[0].behandlet_at).toBeNull()
    })

    it('vanlig bruker får 403 på listen', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const get = await api('/api/v1/feedback', { user: 'alice' })
        expect(get.status).toBe(403)
    })

    it('superadmin kan markere som behandlet og angre', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await seedUser({ firebase_user_id: 'admin', name: 'Admin', superadmin: true })
        await api('/api/v1/feedback', { user: 'alice', method: 'POST', body: { message: 'Test' } })

        const før = await (await api('/api/v1/feedback', { user: 'admin' })).json()
        const id = før[0].id

        const put = await api(`/api/v1/feedback/${id}`, {
            user: 'admin',
            method: 'PUT',
            body: { behandlet: true },
        })
        expect(put.status).toBe(200)

        const etter = await (await api('/api/v1/feedback', { user: 'admin' })).json()
        expect(etter[0].behandlet_at).not.toBeNull()

        await api(`/api/v1/feedback/${id}`, { user: 'admin', method: 'PUT', body: { behandlet: false } })
        const angret = await (await api('/api/v1/feedback', { user: 'admin' })).json()
        expect(angret[0].behandlet_at).toBeNull()
    })

    it('vanlig bruker får 403 på behandlet-endring', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await seedUser({ firebase_user_id: 'admin', name: 'Admin', superadmin: true })
        await api('/api/v1/feedback', { user: 'alice', method: 'POST', body: { message: 'Test' } })
        const list = await (await api('/api/v1/feedback', { user: 'admin' })).json()

        const put = await api(`/api/v1/feedback/${list[0].id}`, {
            user: 'alice',
            method: 'PUT',
            body: { behandlet: true },
        })
        expect(put.status).toBe(403)
    })
})
