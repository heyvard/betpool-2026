import { PoolClient } from 'pg'

import { fyrMorgenrapportVedNattslutt, nattFerdigRapportDatoer } from '../../src/server/feed/morgenrapport'
import { seedBet, seedUser, truncateAll, withDb } from '../support/db'

// Bøtte-test mot ekte Postgres (PGlite): nattFerdigRapportDatoer regner ut
// rapport-bøtta (08:00-grensen norsk tid) i SQL, og fyr-funksjonen legger
// morgenrapporten rett over nattens siste kamppost. Begge er SQL-tunge, så de
// testes mot ekte DB framfor med mock-klient.

// Kampene som havner i samme rapport-bøtte (rapportdato 2026-06-26): kvelds-
// kampene 25. juni og natt-kampene tidlig 26. juni — alle før 08:00-grensen
// 26. juni. 537349/537350 er nattens siste (02:00Z = 04:00 Oslo).
const BØTTE_2606 = [537355, 537356, 537361, 537362, 537349, 537350]
const SISTE_NATTKAMP = 537349

async function settStatus(matchNums: number[], status: string): Promise<void> {
    await withDb((c) => c.query(`UPDATE matches SET status = $1 WHERE match_num = ANY($2)`, [status, matchNums]))
}

beforeEach(async () => {
    await truncateAll()
    // feed_standings_snapshot tømmes ikke av truncateAll — rydd den selv så
    // baseline-datoen i testene er forutsigbar.
    await withDb((c) => c.query('DELETE FROM feed_standings_snapshot'))
})

afterAll(async () => {
    // Tilbakestill kampstatusene vi rotet med (matches truncates ikke).
    await settStatus(BØTTE_2606, 'TIMED')
})

describe('nattFerdigRapportDatoer', () => {
    it('returnerer rapportdatoen når hele bøtta er ferdigspilt', async () => {
        await settStatus(BØTTE_2606, 'FINISHED')
        const datoer = await withDb((c) => nattFerdigRapportDatoer(c as unknown as PoolClient, [SISTE_NATTKAMP]))
        expect(datoer).toEqual(['2026-06-26'])
    })

    it('returnerer ingenting når en kamp i bøtta fortsatt venter', async () => {
        await settStatus(BØTTE_2606, 'FINISHED')
        await settStatus([537350], 'TIMED') // en simultankamp i samme bøtte er ikke ferdig
        const datoer = await withDb((c) => nattFerdigRapportDatoer(c as unknown as PoolClient, [SISTE_NATTKAMP]))
        expect(datoer).toEqual([])
    })

    it('utsatt kamp (POSTPONED) blokkerer ikke rapporten', async () => {
        await settStatus(BØTTE_2606, 'FINISHED')
        await settStatus([537350], 'POSTPONED')
        const datoer = await withDb((c) => nattFerdigRapportDatoer(c as unknown as PoolClient, [SISTE_NATTKAMP]))
        expect(datoer).toEqual(['2026-06-26'])
    })

    it('tom liste inn → tom liste ut', async () => {
        const datoer = await withDb((c) => nattFerdigRapportDatoer(c as unknown as PoolClient, []))
        expect(datoer).toEqual([])
    })
})

describe('fyrMorgenrapportVedNattslutt', () => {
    it('poster morgenrapporten rett over nattens siste kamppost', async () => {
        await settStatus(BØTTE_2606, 'FINISHED')

        const u1 = await seedUser({ firebase_user_id: 'u1' })
        await seedBet({ user_id: u1.id, match_num: SISTE_NATTKAMP, home_score: 3, away_score: 2 })

        await withDb(async (c) => {
            // Synket sluttresultat for siste kamp, med score_synced_at INNE i
            // rapportvinduet (fram til 08:00 Oslo 26. juni) så den telles.
            await c.query(
                `INSERT INTO match_scores (match_num, synced_home_ft, synced_away_ft, use_manual, score_synced_at, created_at, updated_at)
                 VALUES ($1, 3, 2, false, '2026-06-26T04:05:00Z', now(), now())`,
                [SISTE_NATTKAMP],
            )
            // Baseline-snapshot dagen før, så rapporten har noe å sammenligne med.
            await c.query(
                `INSERT INTO feed_standings_snapshot (dato, user_id, plass, poeng) VALUES ('2026-06-25', $1, 1, 0)`,
                [u1.id],
            )
            // To kampposter i bøtta — morgenrapporten skal legges 1 sek etter den seneste.
            await c.query(
                `INSERT INTO feed_posts (kind, scenario, match_num, accent, tittel, body, data, created_at)
                 VALUES ('kamp', 'leder_best', 537355, 'win', 't', 'b', '{}', '2026-06-26T00:10:00Z'),
                        ('kamp', 'leder_best', $1, 'win', 't', 'b', '{}', '2026-06-26T04:10:00Z')`,
                [SISTE_NATTKAMP],
            )
        })

        const nå = new Date('2026-06-26T05:00:00Z')
        const postet = await withDb((c) =>
            fyrMorgenrapportVedNattslutt(c as unknown as PoolClient, [SISTE_NATTKAMP], nå),
        )
        expect(postet).toEqual(['2026-06-26'])

        const rad = await withDb((c) =>
            c.query<{ created_at: string; siste_kamp: string }>(
                `SELECT mr.created_at,
                        (SELECT max(created_at) FROM feed_posts WHERE kind = 'kamp') AS siste_kamp
                 FROM feed_posts mr
                 WHERE mr.kind = 'morgenrapport' AND mr.dato = '2026-06-26'`,
            ),
        )
        expect(rad.rows).toHaveLength(1)
        // Morgenrapporten ligger over (nyere enn) nattens siste kamppost.
        expect(new Date(rad.rows[0].created_at).getTime()).toBeGreaterThan(new Date(rad.rows[0].siste_kamp).getTime())
        // Konkret: seneste kamppost (04:10:00) + 1 sek.
        expect(new Date(rad.rows[0].created_at).toISOString()).toBe('2026-06-26T04:10:01.000Z')
    })

    it('er idempotent — andre kjøring poster ikke på nytt', async () => {
        await settStatus(BØTTE_2606, 'FINISHED')
        const u1 = await seedUser({ firebase_user_id: 'u1' })
        await seedBet({ user_id: u1.id, match_num: SISTE_NATTKAMP, home_score: 3, away_score: 2 })
        await withDb(async (c) => {
            await c.query(
                `INSERT INTO match_scores (match_num, synced_home_ft, synced_away_ft, use_manual, score_synced_at, created_at, updated_at)
                 VALUES ($1, 3, 2, false, '2026-06-26T04:05:00Z', now(), now())`,
                [SISTE_NATTKAMP],
            )
            await c.query(
                `INSERT INTO feed_standings_snapshot (dato, user_id, plass, poeng) VALUES ('2026-06-25', $1, 1, 0)`,
                [u1.id],
            )
        })
        const nå = new Date('2026-06-26T05:00:00Z')
        const først = await withDb((c) =>
            fyrMorgenrapportVedNattslutt(c as unknown as PoolClient, [SISTE_NATTKAMP], nå),
        )
        expect(først).toEqual(['2026-06-26'])
        const igjen = await withDb((c) =>
            fyrMorgenrapportVedNattslutt(c as unknown as PoolClient, [SISTE_NATTKAMP], nå),
        )
        expect(igjen).toEqual([])
        const antall = await withDb((c) =>
            c.query(`SELECT count(*)::int AS n FROM feed_posts WHERE kind = 'morgenrapport'`),
        )
        expect(antall.rows[0].n).toBe(1)
    })
})
