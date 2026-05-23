import { api, seedUser, truncateAll } from './helpers'

beforeEach(truncateAll)

// Oppretter en liga som `owner` og returnerer liga-id.
async function lagLiga(owner: string, body: object = { name: 'Testliga' }): Promise<string> {
    const res = await api('/api/v1/leagues', { user: owner, method: 'POST', body })
    expect(res.status).toBe(201)
    return (await res.json()).id
}

describe('/api/v1/leagues', () => {
    it('POST oppretter liga og gjør oppretteren til medlem/eier', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const id = await lagLiga('alice', { name: 'Alfaliga', innsats: 200, betalingsinfo: 'Vipps 123' })
        expect(id).toBeTruthy()

        const liste = await (await api('/api/v1/leagues', { user: 'alice' })).json()
        expect(liste).toHaveLength(1)
        expect(liste[0].name).toBe('Alfaliga')
        expect(liste[0].innsats).toBe(200)
        expect(liste[0].my_status).toBe('medlem')
        expect(liste[0].is_owner).toBe(true)
        expect(liste[0].member_count).toBe(1)
    })

    it('POST avviser tomt navn', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/leagues', { user: 'alice', method: 'POST', body: { name: '  ' } })
        expect(res.status).toBe(400)
    })

    it('invitasjon + takk ja gir medlemskap', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const bob = await seedUser({ firebase_user_id: 'bob' })
        const id = await lagLiga('alice')

        const inv = await api(`/api/v1/leagues/${id}/members`, {
            user: 'alice',
            method: 'POST',
            body: { user_id: bob.id },
        })
        expect(inv.status).toBe(201)

        const invitert = await (await api('/api/v1/leagues', { user: 'bob' })).json()
        expect(invitert[0].my_status).toBe('invitert')

        const aksept = await api(`/api/v1/leagues/${id}/members/${bob.id}`, {
            user: 'bob',
            method: 'PUT',
            body: { status: 'medlem' },
        })
        expect(aksept.status).toBe(200)

        const etter = await (await api('/api/v1/leagues', { user: 'bob' })).json()
        expect(etter[0].my_status).toBe('medlem')
    })

    it('invitert bruker kan takke nei', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const bob = await seedUser({ firebase_user_id: 'bob' })
        const id = await lagLiga('alice')

        await api(`/api/v1/leagues/${id}/members`, { user: 'alice', method: 'POST', body: { user_id: bob.id } })

        const nei = await api(`/api/v1/leagues/${id}/members/${bob.id}`, { user: 'bob', method: 'DELETE' })
        expect(nei.status).toBe(200)

        const bobsLigaer = await (await api('/api/v1/leagues', { user: 'bob' })).json()
        expect(bobsLigaer).toHaveLength(0)
    })

    it('bare eieren kan invitere', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        await seedUser({ firebase_user_id: 'bob' })
        const carol = await seedUser({ firebase_user_id: 'carol' })
        const id = await lagLiga('alice')

        const res = await api(`/api/v1/leagues/${id}/members`, {
            user: 'bob',
            method: 'POST',
            body: { user_id: carol.id },
        })
        expect(res.status).toBe(403)
    })

    it('GET /leagues/:id er stengt for ikke-medlemmer', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        await seedUser({ firebase_user_id: 'bob' })
        const id = await lagLiga('alice')

        const res = await api(`/api/v1/leagues/${id}`, { user: 'bob' })
        expect(res.status).toBe(403)
    })

    it('eieren setter betalt-status på et medlem', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const bob = await seedUser({ firebase_user_id: 'bob' })
        const id = await lagLiga('alice')

        await api(`/api/v1/leagues/${id}/members`, { user: 'alice', method: 'POST', body: { user_id: bob.id } })
        await api(`/api/v1/leagues/${id}/members/${bob.id}`, {
            user: 'bob',
            method: 'PUT',
            body: { status: 'medlem' },
        })

        const res = await api(`/api/v1/leagues/${id}/members/${bob.id}`, {
            user: 'alice',
            method: 'PUT',
            body: { paid: true },
        })
        expect(res.status).toBe(200)

        const detalj = await (await api(`/api/v1/leagues/${id}`, { user: 'alice' })).json()
        const bobMedlem = detalj.members.find((m: { user_id: string }) => m.user_id === bob.id)
        expect(bobMedlem.paid).toBe(true)
    })

    it('et medlem kan ikke sette betalt-status', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const bob = await seedUser({ firebase_user_id: 'bob' })
        const id = await lagLiga('alice')

        await api(`/api/v1/leagues/${id}/members`, { user: 'alice', method: 'POST', body: { user_id: bob.id } })
        await api(`/api/v1/leagues/${id}/members/${bob.id}`, {
            user: 'bob',
            method: 'PUT',
            body: { status: 'medlem' },
        })

        const res = await api(`/api/v1/leagues/${id}/members/${bob.id}`, {
            user: 'bob',
            method: 'PUT',
            body: { paid: true },
        })
        expect(res.status).toBe(403)
    })

    it('bare eieren kan slette ligaen', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        await seedUser({ firebase_user_id: 'bob' })
        const id = await lagLiga('alice')

        const bobForsøk = await api(`/api/v1/leagues/${id}`, { user: 'bob', method: 'DELETE' })
        expect(bobForsøk.status).toBe(403)

        const eierSletter = await api(`/api/v1/leagues/${id}`, { user: 'alice', method: 'DELETE' })
        expect(eierSletter.status).toBe(200)

        const liste = await (await api('/api/v1/leagues', { user: 'alice' })).json()
        expect(liste).toHaveLength(0)
    })

    it('invitable-users lister aktive brukere', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await seedUser({ firebase_user_id: 'bob', name: 'Bob' })
        await seedUser({ firebase_user_id: 'inaktiv', name: 'Inaktiv', active: false })

        const res = await api('/api/v1/leagues/invitable-users', { user: 'alice' })
        expect(res.status).toBe(200)
        const navn = (await res.json()).map((u: { name: string }) => u.name)
        expect(navn).toContain('Alice')
        expect(navn).toContain('Bob')
        expect(navn).not.toContain('Inaktiv')
    })
})
