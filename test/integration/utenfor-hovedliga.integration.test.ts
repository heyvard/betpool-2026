import { api, seedUser, truncateAll } from './helpers'
import { seedLeague, seedLeagueMember } from '../support/db'

beforeEach(truncateAll)

describe('/api/v1/admin/utenfor-hovedliga', () => {
    it('lister kun brukere som har valgt bort hovedligaen, med ligaene deres', async () => {
        await seedUser({ firebase_user_id: 'admin', name: 'Admin', superadmin: true })
        await seedUser({ firebase_user_id: 'med', name: 'Med I Hovedliga', i_hovedliga: true })
        const ute = await seedUser({ firebase_user_id: 'ute', name: 'Utenfor', i_hovedliga: false })

        const liga = await seedLeague({ name: 'Privatliga', owner_user_id: ute.id })
        await seedLeagueMember({ league_id: liga.id, user_id: ute.id, status: 'medlem' })

        const res = await api('/api/v1/admin/utenfor-hovedliga', { user: 'admin' })
        expect(res.status).toBe(200)
        const data = await res.json()

        expect(data).toHaveLength(1)
        expect(data[0].name).toBe('Utenfor')
        expect(data[0].ligaer).toHaveLength(1)
        expect(data[0].ligaer[0].name).toBe('Privatliga')
        expect(data[0].ligaer[0].status).toBe('medlem')
    })

    it('er stengt for ikke-superadmin', async () => {
        await seedUser({ firebase_user_id: 'vanlig', name: 'Vanlig' })
        const res = await api('/api/v1/admin/utenfor-hovedliga', { user: 'vanlig' })
        expect(res.status).toBe(403)
    })
})
