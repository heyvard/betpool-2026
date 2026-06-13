import { api, førsteMatchNum, seedUser, truncateAll, withDb } from './helpers'
import { seedBet } from '../support/db'

beforeEach(truncateAll)

describe('tipping', () => {
    it('PUT /api/v1/me/bets/[id] lagrer og upserter tips', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const matchNum = await førsteMatchNum()
        // Sett klokka til før turneringen startet, slik at APIet godtar tipset
        const clock = '2026-06-01T00:00:00Z'

        const first = await api(`/api/v1/me/bets/${matchNum}`, {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 2, away_score: 1 },
            clock,
        })
        expect(first.status).toBe(200)

        let rows = await withDb((c) =>
            c.query('SELECT home_score, away_score FROM bets WHERE match_num = $1', [matchNum]),
        )
        expect(rows.rows).toHaveLength(1)
        expect(rows.rows[0]).toMatchObject({ home_score: 2, away_score: 1 })

        // upsert — samme kamp igjen skal oppdatere, ikke lage ny rad
        await api(`/api/v1/me/bets/${matchNum}`, {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 3, away_score: 3 },
            clock,
        })
        rows = await withDb((c) => c.query('SELECT home_score, away_score FROM bets WHERE match_num = $1', [matchNum]))
        expect(rows.rows).toHaveLength(1)
        expect(rows.rows[0]).toMatchObject({ home_score: 3, away_score: 3 })
    })

    it('PUT /api/v1/me/bets/[id] gir 404 for ukjent kamp', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/me/bets/99999', {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 1, away_score: 0 },
        })
        expect(res.status).toBe(404)
    })

    it('PUT /api/v1/me/bets/[id] gir 400 for ugyldig match_num', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const res = await api('/api/v1/me/bets/abc', {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 1, away_score: 0 },
        })
        expect(res.status).toBe(400)
    })

    it('PUT /api/v1/me/bets/[id] gir 400 når en score mangler', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const matchNum = await førsteMatchNum()
        const res = await api(`/api/v1/me/bets/${matchNum}`, {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 2, away_score: null },
        })
        expect(res.status).toBe(400)

        const rows = await withDb((c) => c.query('SELECT * FROM bets WHERE match_num = $1', [matchNum]))
        expect(rows.rows).toHaveLength(0)
    })

    it('GET /api/v1/me/bets returnerer egne tip per kamp', async () => {
        await seedUser({ firebase_user_id: 'alice' })
        const matchNum = await førsteMatchNum()
        // Sett klokka til før turneringen startet, slik at APIet godtar tipset
        const clock = '2026-06-01T00:00:00Z'
        await api(`/api/v1/me/bets/${matchNum}`, {
            user: 'alice',
            method: 'PUT',
            body: { home_score: 2, away_score: 1 },
            clock,
        })

        const res = await api('/api/v1/me/bets', { user: 'alice' })
        expect(res.status).toBe(200)
        const bets = await res.json()
        const kamp1 = bets.find((b: { match_num: number }) => b.match_num === matchNum)
        expect(kamp1).toMatchObject({ home_score: 2, away_score: 1 })
    })

    it('GET /api/v1/bets returnerer { bets, users }', async () => {
        await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        await seedUser({ firebase_user_id: 'bob', name: 'Bob' })

        const res = await api('/api/v1/bets', { user: 'alice' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body.bets)).toBe(true)
        expect(body.users.map((u: { name: string }) => u.name).sort()).toEqual(['Alice', 'Bob'])
    })

    it('GET /api/v1/bets bruker den synkede (automatiske) scoren når use_manual er av', async () => {
        const alice = await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
        const matchNum = await førsteMatchNum()
        await seedBet({ user_id: alice.id, match_num: matchNum, home_score: 4, away_score: 1 })

        // Synket resultat satt, men ingen manuell score og use_manual = false.
        // Tidligere ble da home/away_result null → defaultet til 0–0 i beregningen.
        await withDb((c) =>
            c.query(
                `INSERT INTO match_scores (match_num, synced_home_ft, synced_away_ft, use_manual)
                 VALUES ($1, 4, 1, false)`,
                [matchNum],
            ),
        )

        // Sen klokke slik at kampen regnes som spilt og taes med i bets-lista
        const res = await api('/api/v1/bets', { user: 'alice', clock: '2030-01-01T00:00:00Z' })
        expect(res.status).toBe(200)
        const body = await res.json()
        const bet = body.bets.find((b: { match_num: number }) => b.match_num === matchNum)
        expect(bet).toMatchObject({ home_result: 4, away_result: 1 })
    })
})
