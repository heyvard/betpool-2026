import { api, seedUser, truncateAll } from './helpers'

beforeEach(truncateAll)

describe('/api/v1/me/kallenavn', () => {
    it('lagrer kallenavn og returnerer det rått fra /me', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice Andersen' })

        const put = await api('/api/v1/me/kallenavn', {
            user: 'alice',
            method: 'PUT',
            body: { kallenavn: 'Lynet' },
        })
        expect(put.status).toBe(200)

        const me = await (await api('/api/v1/me', { user: 'alice' })).json()
        expect(me.kallenavn).toBe('Lynet')
        expect(me.name).toBe('Alice Andersen')
    })

    it('viser kallenavnet i stedet for navnet i /bets', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice Andersen' })
        await api('/api/v1/me/kallenavn', { user: 'alice', method: 'PUT', body: { kallenavn: 'Lynet' } })

        const bets = await (await api('/api/v1/bets', { user: 'alice' })).json()
        const alice = bets.users.find((u: { id: string; name: string }) => u.name === 'Lynet')
        expect(alice).toBeDefined()
    })

    it('tomt kallenavn faller tilbake til navnet i /bets', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice Andersen' })
        await api('/api/v1/me/kallenavn', { user: 'alice', method: 'PUT', body: { kallenavn: 'Lynet' } })
        await api('/api/v1/me/kallenavn', { user: 'alice', method: 'PUT', body: { kallenavn: '   ' } })

        const bets = await (await api('/api/v1/bets', { user: 'alice' })).json()
        const alice = bets.users.find((u: { name: string }) => u.name === 'Alice Andersen')
        expect(alice).toBeDefined()
    })

    it('avviser for langt kallenavn', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        const put = await api('/api/v1/me/kallenavn', {
            user: 'alice',
            method: 'PUT',
            body: { kallenavn: 'x'.repeat(31) },
        })
        expect(put.status).toBe(400)
    })
})
