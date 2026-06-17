import { api, seedUser, truncateAll, withDb } from './helpers'

// Den klient-trigget live-synken: hver GET /api/v1/matches forsøker å "claime"
// et synk-slot via en atomisk betinget UPDATE mot sync_state. Vi kan ikke telle
// football-data-kall fra testprosessen (synken skjer inne i next-serveren), men
// vi kan verifisere selve throttle-gaten direkte mot sync_state: den skal
// avansere live_synced_at maks én gang per intervall, uansett hvor mange kall
// som kommer. Det er nettopp denne coalescing-en som holder oss under
// rate-limiten.

const INTERVALL_SEKUNDER = 15

async function lesLiveSyncedAt(): Promise<Date> {
    return withDb(async (c) => {
        const r = await c.query<{ live_synced_at: Date }>(`SELECT live_synced_at FROM sync_state WHERE id = 'live'`)
        return new Date(r.rows[0].live_synced_at)
    })
}

async function settLiveSyncedAt(tidspunkt: Date): Promise<void> {
    await withDb((c) =>
        c.query(`UPDATE sync_state SET live_synced_at = $1 WHERE id = 'live'`, [tidspunkt.toISOString()]),
    )
}

beforeEach(truncateAll)

describe('/api/v1/matches — live-synk throttle', () => {
    it('claimer slottet og avanserer sync_state ved første GET etter intervallet', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        // Sett siste synk langt tilbake i tid → neste GET skal claime slottet.
        await settLiveSyncedAt(new Date(0))

        const res = await api('/api/v1/matches', { user: 'alice' })
        expect(res.status).toBe(200)

        const etter = await lesLiveSyncedAt()
        expect(etter.getTime()).toBeGreaterThan(Date.now() - 60_000)
    })

    it('avanserer ikke på nytt innenfor samme intervall (coalescing av samtidige poll)', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        await settLiveSyncedAt(new Date(0))

        // Første GET claimer slottet.
        await api('/api/v1/matches', { user: 'alice' })
        const t1 = await lesLiveSyncedAt()

        // Mange samtidige GET-er innenfor 15s-vinduet skal IKKE føre til nye
        // claims — live_synced_at står stille → kun ett football-data-kall ville
        // ha skjedd.
        await Promise.all(Array.from({ length: 10 }, () => api('/api/v1/matches', { user: 'alice' })))
        const t2 = await lesLiveSyncedAt()
        expect(t2.getTime()).toBe(t1.getTime())
    })

    it('claimer på nytt når intervallet har passert', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        // Sett siste synk akkurat utenfor vinduet → neste GET skal claime igjen.
        await settLiveSyncedAt(new Date(Date.now() - (INTERVALL_SEKUNDER + 5) * 1000))
        const før = await lesLiveSyncedAt()

        await api('/api/v1/matches', { user: 'alice' })
        const etter = await lesLiveSyncedAt()
        expect(etter.getTime()).toBeGreaterThan(før.getTime())
    })
})
