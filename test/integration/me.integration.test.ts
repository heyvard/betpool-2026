import { api, seedUser, seedPlayer, truncateAll, withDb } from './helpers'
import { testKamper } from '../support/matches'

beforeEach(truncateAll)

const alleKamper = testKamper()
const forsteKampstart = (round: number) =>
    Math.min(...alleKamper.filter((m) => m.round === round).map((m) => new Date(m.game_start).getTime()))
const I_BYTTEVINDUET = new Date(forsteKampstart(2) + 3 * 60 * 60 * 1000).toISOString()

describe('/api/v1/me', () => {
    it('oppretter ny bruker ved første kall', async () => {
        const res = await api('/api/v1/me', { user: 'nybrukeren' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.firebase_user_id).toBe('nybrukeren')
        expect(body.email).toBe('nybrukeren@test.local')

        const count = await withDb((c) =>
            c.query('SELECT count(*)::int AS n FROM users WHERE firebase_user_id = $1', ['nybrukeren']),
        )
        expect(count.rows[0].n).toBe(1)
    })

    it('henter eksisterende bruker uten å lage ny rad', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await api('/api/v1/me', { user: 'alice' })
        const res = await api('/api/v1/me', { user: 'alice' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe('Alice')

        const count = await withDb((c) =>
            c.query('SELECT count(*)::int AS n FROM users WHERE firebase_user_id = $1', ['alice']),
        )
        expect(count.rows[0].n).toBe(1)
    })

    it('PUT oppdaterer winner', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        // Vinner kan kun settes i første runde-vinduet (før 2. gruppespillsrunde).
        // Pinn klokka til før VM, ellers avvises oppdateringen når testen kjøres
        // etter at vinduet faktisk har stengt (jf. erIFørsteRundeMed).
        const put = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { winner: 'Brazil' },
            clock: '2026-06-01T12:00:00Z',
        })
        expect(put.status).toBe(200)

        const me = await (await api('/api/v1/me', { user: 'alice' })).json()
        expect(me.winner).toBe('Brazil')
    })

    it('PUT setter strukturert topscorer_player_id i første runde', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await seedPlayer({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })

        const put = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { topscorerPlayerId: 20 },
            clock: '2026-06-01T12:00:00Z',
        })
        expect(put.status).toBe(200)

        const me = await (await api('/api/v1/me', { user: 'alice' })).json()
        expect(me.topscorer_player_id).toBe(20)
    })

    it('PUT med ukjent topscorerPlayerId gir 400', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })

        const put = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { topscorerPlayerId: 999 },
            clock: '2026-06-01T12:00:00Z',
        })
        expect(put.status).toBe(400)
    })

    it('byttevindu: ett bytte brukes opp — verken et nytt bytte eller et forsøk på å gjenopprette det opprinnelige tipset endrer noe', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice', winner: 'ARG' })
        await seedPlayer({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })
        await seedPlayer({ id: 21, name: 'Kylian Mbappé', team_tla: 'FRA' })
        await withDb((c) => c.query(`UPDATE users SET topscorer_player_id = 20 WHERE firebase_user_id = 'alice'`))

        // Første bytte i byttevinduet (mellom runde 2 og kvartfinalen) — skal gå gjennom.
        const førsteBytte = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { winner: 'BRA', topscorerPlayerId: 21 },
            clock: I_BYTTEVINDUET,
        })
        expect(førsteBytte.status).toBe(200)

        const etterFørsteBytte = await withDb((c) =>
            c.query(
                `SELECT winner, winner_endret, winner_forrige, topscorer_player_id, topscorer_endret, topscorer_forrige_player_id
                 FROM users WHERE firebase_user_id = 'alice'`,
            ),
        )
        expect(etterFørsteBytte.rows[0]).toMatchObject({
            winner: 'BRA',
            winner_endret: true,
            winner_forrige: 'ARG',
            topscorer_player_id: 21,
            topscorer_endret: true,
            topscorer_forrige_player_id: 20,
        })

        // Forsøk på å gjenopprette det opprinnelige tipset (ARG/Haaland) — skal IKKE endre noe,
        // ettersom byttet allerede er brukt opp.
        const forsokGjenopprette = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { winner: 'ARG', topscorerPlayerId: 20 },
            clock: I_BYTTEVINDUET,
        })
        expect(forsokGjenopprette.status).toBe(200)

        // Forsøk på et nytt (andre) bytte — skal heller ikke endre noe.
        const forsokNyttBytte = await api('/api/v1/me', {
            user: 'alice',
            method: 'PUT',
            body: { winner: 'FRA', topscorerPlayerId: null },
            clock: I_BYTTEVINDUET,
        })
        expect(forsokNyttBytte.status).toBe(200)

        const etterForsok = await withDb((c) =>
            c.query(
                `SELECT winner, winner_endret, winner_forrige, topscorer_player_id, topscorer_endret, topscorer_forrige_player_id
                 FROM users WHERE firebase_user_id = 'alice'`,
            ),
        )
        expect(etterForsok.rows[0]).toMatchObject({
            winner: 'BRA',
            winner_endret: true,
            winner_forrige: 'ARG',
            topscorer_player_id: 21,
            topscorer_endret: true,
            topscorer_forrige_player_id: 20,
        })

        // Kun én bytte-post per kategori i feeden, selv om PUT ble kalt tre ganger.
        const feedPoster = await withDb((c) =>
            c.query(`SELECT bytte_type FROM feed_posts WHERE kind = 'bytte' ORDER BY bytte_type`),
        )
        expect(feedPoster.rows).toEqual([{ bytte_type: 'toppscorer' }, { bytte_type: 'vinner' }])
    })
})
