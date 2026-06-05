import { test, expect, type BrowserContext } from '@playwright/test'

import { seedBet, seedUser, truncateAll, withDb } from '../support/db'
import { testKamper } from '../support/matches'

// Hovedfeltene på hjemmesiden (/) for de første dagene: sette VM-vinner og
// toppscorer i åpen periode, betalingsvarsel, «Neste kampdag»-oversikten, og
// at vinner/toppscorer låses når VM er i gang. Selve kamp-tippingen dekkes av
// betview-autolagring.spec.ts og turnering.spec.ts.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

// Frist-instanter utledet fra kampprogrammet (samme mønster som turnering.spec.ts):
// - vinner/toppscorer-fristen er starten på runde 2.
// - endrevinduet (kan endre én gang mot halve poeng) varer frem til kvartfinalen
//   (runde 6). For en *ren* låst tilstand må klokka derfor være etter runde 6.
const alleKamper = testKamper()
const forsteKampstart = (round: number) =>
    Math.min(...alleKamper.filter((m) => m.round === round).map((m) => new Date(m.game_start).getTime()))

const FØR_TURNERING = '2026-06-01T00:00:00.000Z'
const ETTER_ENDREVINDU = new Date(forsteKampstart(6) + 3 * 60 * 60 * 1000).toISOString()

async function loggInn(context: BrowserContext, fid: string, klokke: string): Promise<void> {
    await context.addCookies([
        { name: 'betpool_test_user', value: fid, url: URL_BASE },
        { name: 'betpool_test_clock', value: klokke, url: URL_BASE },
    ])
}

test.beforeEach(async () => {
    await truncateAll()
})

test('vinner og toppscorer kan settes og lagres i åpen periode', async ({ context, page }) => {
    await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })
    await loggInn(context, 'alice', FØR_TURNERING)

    await page.goto('/')

    // Åpen periode: redigerbart, med frist-tekst.
    await expect(page.getByText('Åpent')).toBeVisible()
    await expect(page.getByText(/Kan endres frem til/)).toBeVisible()

    const vinnerKort = page.locator('div.space-y-1').filter({ hasText: 'Hvem løfter pokalen?' })
    const toppscorerKort = page.locator('div.space-y-1').filter({ hasText: 'Hvem scorer flest mål?' })

    // Velg verdensmester via det skjulte select-elementet (ARG = Argentina).
    await vinnerKort.getByRole('combobox', { name: 'Velg verdensmester' }).selectOption('ARG')
    await expect(vinnerKort.getByText('Lagret')).toBeVisible()

    // Toppscorer skrives som fritekst; lagres debouncet (~600 ms).
    await toppscorerKort.locator('#topscorer-input').fill('Erling Haaland')
    await expect(toppscorerKort.getByText('Lagret')).toBeVisible()

    // Verifiser at det faktisk er lagret i DB.
    const lagret = await withDb((c) =>
        c.query<{ winner: string; topscorer: string }>(
            'SELECT winner, topscorer FROM users WHERE firebase_user_id = $1',
            ['alice'],
        ),
    )
    expect(lagret.rows[0]).toMatchObject({ winner: 'ARG', topscorer: 'Erling Haaland' })
})

test('betalingsvarsel vises for ubetalt hovedliga-bruker', async ({ context, page }) => {
    await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: false, i_hovedliga: true })
    await loggInn(context, 'alice', FØR_TURNERING)

    await page.goto('/')
    await expect(page.getByText('918 65 052')).toBeVisible()
})

test('betalingsvarsel skjules når brukeren har betalt', async ({ context, page }) => {
    await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true, i_hovedliga: true })
    await loggInn(context, 'alice', FØR_TURNERING)

    await page.goto('/')
    // Vent til siden er lastet (vinnerkortet finnes) før vi sjekker fravær.
    await expect(page.getByText('Hvem løfter pokalen?')).toBeVisible()
    await expect(page.getByText('918 65 052')).toHaveCount(0)
})

test('vinner og toppscorer er låst når VM er i gang', async ({ context, page }) => {
    await seedUser({
        firebase_user_id: 'alice',
        name: 'alice',
        paid: true,
        winner: 'ARG',
        topscorer: 'Erling Haaland',
    })
    await loggInn(context, 'alice', ETTER_ENDREVINDU)

    await page.goto('/')

    await expect(page.getByText('Låst', { exact: true })).toBeVisible()
    await expect(page.getByText('VM er i gang — vinner og toppscorer er låst.')).toBeVisible()

    // Ingen redigerbare kontroller igjen.
    await expect(page.getByRole('combobox', { name: 'Velg verdensmester' })).toHaveCount(0)
    await expect(page.locator('#topscorer-input')).toHaveCount(0)

    // De valgte verdiene vises fortsatt (ARG → «Argentina»).
    await expect(page.getByText('Argentina')).toBeVisible()
    await expect(page.getByText('Erling Haaland')).toBeVisible()
})

test('neste kampdag viser brukerens tippede kamp', async ({ context, page }) => {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })

    // Velg tidligste runde 1-kamp og still klokka 1 time før avspark, slik at
    // den er en kommende kamp på «Neste kampdag». Tipp den (2–1), de øvrige står
    // utippet.
    const m0 = alleKamper
        .filter((m) => m.round === 1)
        .sort((a, b) => +new Date(a.game_start) - +new Date(b.game_start))[0]
    await seedBet({ user_id: alice.id, match_num: m0.match_num, home_score: 2, away_score: 1 })

    const enTimeFør = new Date(new Date(m0.game_start).getTime() - 60 * 60 * 1000).toISOString()
    await loggInn(context, 'alice', enTimeFør)

    await page.goto('/')
    await expect(page.getByText('Neste kampdag')).toBeVisible()
    // Den tippede kampen vises med scoren sin (en-dash, som i index.tsx).
    await expect(page.getByText('2–1')).toBeVisible()
})
