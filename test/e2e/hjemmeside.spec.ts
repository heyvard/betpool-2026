import { test, expect, type BrowserContext } from '@playwright/test'

import { seedBet, seedPlayer, seedUser, truncateAll, withDb } from '../support/db'
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
    await seedPlayer({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })
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

    // Toppscorer velges strukturert fra spillervelgeren: åpne, søk, klikk treff.
    await toppscorerKort.getByRole('button', { name: 'Skriv navn' }).click()
    await toppscorerKort.getByPlaceholder('Søk spiller …').fill('Haaland')
    await toppscorerKort.getByRole('button', { name: /Erling Haaland/ }).click()
    await expect(toppscorerKort.getByText('Lagret')).toBeVisible()

    // Verifiser at det faktisk er lagret i DB.
    const lagret = await withDb((c) =>
        c.query<{ winner: string; topscorer_player_id: number }>(
            'SELECT winner, topscorer_player_id FROM users WHERE firebase_user_id = $1',
            ['alice'],
        ),
    )
    expect(lagret.rows[0]).toMatchObject({ winner: 'ARG', topscorer_player_id: 20 })
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
    await seedPlayer({ id: 20, name: 'Erling Haaland', team_tla: 'NOR' })
    await seedUser({
        firebase_user_id: 'alice',
        name: 'alice',
        paid: true,
        winner: 'ARG',
        topscorer_player_id: 20,
    })
    await loggInn(context, 'alice', ETTER_ENDREVINDU)

    await page.goto('/')

    await expect(page.getByText('Låst', { exact: true })).toBeVisible()
    await expect(page.getByText('VM er i gang — vinner og toppscorer er låst.')).toBeVisible()

    // Ingen redigerbare kontroller igjen.
    await expect(page.getByRole('combobox', { name: 'Velg verdensmester' })).toHaveCount(0)
    await expect(page.getByPlaceholder('Søk spiller …')).toHaveCount(0)

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

test('kommende kamp lenker til tipping, startet kamp lenker til kampsiden', async ({ context, page }) => {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })

    const m0 = alleKamper
        .filter((m) => m.round === 1)
        .sort((a, b) => +new Date(a.game_start) - +new Date(b.game_start))[0]
    await seedBet({ user_id: alice.id, match_num: m0.match_num, home_score: 2, away_score: 1 })

    // Kommende kamp (1 time før avspark): kampraden lenker til tippesiden.
    const enTimeFør = new Date(new Date(m0.game_start).getTime() - 60 * 60 * 1000).toISOString()
    await loggInn(context, 'alice', enTimeFør)
    await page.goto('/')
    await expect(page.getByText('Neste kampdag')).toBeVisible()
    await page.getByRole('link').filter({ hasText: '2–1' }).click()
    await expect(page).toHaveURL(new RegExp(`/my-bets#kamp-${m0.match_num}$`))
    // Ankeret scroller til – og fremhever – riktig kamp-kort på tippesiden.
    await expect(page.getByTestId(`bet-${m0.match_num}`)).toBeInViewport()

    // Startet kamp (30 min etter avspark): kampraden lenker til kampsiden.
    const etterAvspark = new Date(new Date(m0.game_start).getTime() + 30 * 60 * 1000).toISOString()
    await loggInn(context, 'alice', etterAvspark)
    await page.goto('/')
    await expect(page.getByText('Neste kampdag')).toBeVisible()
    await page.getByRole('link').filter({ hasText: '2–1' }).click()
    await expect(page).toHaveURL(new RegExp(`/match/${m0.match_num}$`))
})

// Morgenvinduet: kampene starter 18:00–06:00, og kampdag-grensen ligger kl. 10:00
// (10-timers forskyvningen i index.tsx). Mellom 06:00 og 12:00 skal hjemmesiden
// vise neste kampdag (kveldens kommende kamper) PLUSS «Natten som var» (forrige
// natts ferdigspilte kamper). Tidligere viste hovedseksjonen feilaktig forrige
// natt mellom 06:00 og 10:00, og «Natten som var» ble undertrykt.
//
// Tz pinnes til UTC for determinisme: «06:00–12:00 norsk tid» i koden er egentlig
// nettleserens lokaltid, så vi setter den til UTC og bruker kl. 08:00 UTC.
test.describe(() => {
    test.use({ timezoneId: 'UTC' })

    const DAG = 86400e3
    const kampdagNokkel = (ms: number) => Math.floor((ms - 10 * 3600e3) / DAG)

    // Finn de to første påfølgende kampdagene i datasettet (UTC).
    const kampMs = alleKamper.map((m) => new Date(m.game_start).getTime()).sort((a, b) => a - b)
    const dagSett = [...new Set(kampMs.map(kampdagNokkel))].sort((a, b) => a - b)
    let natt = 0
    let kveld = 0
    for (let i = 0; i < dagSett.length - 1; i++) {
        if (dagSett[i + 1] === dagSett[i] + 1) {
            natt = dagSett[i]
            kveld = dagSett[i + 1]
            break
        }
    }
    const nattKamp = alleKamper.find((m) => kampdagNokkel(new Date(m.game_start).getTime()) === natt)!
    const kveldKamp = alleKamper.find((m) => kampdagNokkel(new Date(m.game_start).getTime()) === kveld)!
    // Kl. 08:00 UTC morgenen etter natt-kampene: forrige natt er ferdigspilt,
    // kveldens kamper er fremdeles kommende.
    const kl0800 = new Date(kveld * DAG + 8 * 3600e3).toISOString()

    test('morgenvindu (08:00): viser «Natten som var» over «Neste kampdag»', async ({ context, page }) => {
        const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })
        // Forrige natt 3–1, kveldens kommende kamp 2–0 → unike scorer på siden.
        await seedBet({ user_id: alice.id, match_num: nattKamp.match_num, home_score: 3, away_score: 1 })
        await seedBet({ user_id: alice.id, match_num: kveldKamp.match_num, home_score: 2, away_score: 0 })
        await loggInn(context, 'alice', kl0800)

        await page.goto('/')

        const nattenTittel = page.getByText('Natten som var', { exact: true })
        const nesteTittel = page.getByText('Neste kampdag', { exact: true })
        await expect(nattenTittel).toBeVisible()
        await expect(nesteTittel).toBeVisible()

        // Begge kampene vises, hver under sin seksjon.
        await expect(page.getByText('3–1')).toBeVisible()
        await expect(page.getByText('2–0')).toBeVisible()

        // «Natten som var» skal stå øverst.
        const yNatten = (await nattenTittel.boundingBox())!.y
        const yNeste = (await nesteTittel.boundingBox())!.y
        expect(yNatten).toBeLessThan(yNeste)
    })

    // Natt-hullet: VM-kampene spilles 18:00–06:00, så siste nattkamp kan sparke i
    // gang langt før kl. 06:00. Da demoteres inneværende kampdag fra «Neste kampdag»
    // til morgendagens kamper. Tidligere slo «Natten som var» først inn kl. 06:00,
    // så de nettopp startede nattkampene forsvant helt i vinduet ~03:00–06:00.
    // Nå skal de fortsatt vises som «Natten som var».
    test('natt (kl. 04:00): nettopp startet natt vises som «Natten som var»', async ({ context, page }) => {
        const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })
        await seedBet({ user_id: alice.id, match_num: nattKamp.match_num, home_score: 3, away_score: 1 })
        await seedBet({ user_id: alice.id, match_num: kveldKamp.match_num, home_score: 2, away_score: 0 })

        // Kl. 04:00 morgenen etter natt-kampene (kampdag-nøkkel «kveld» starter
        // egentlig kl. 10:00, så kl. 04:00 ligger fortsatt i «natt»-kampdagen, men
        // etter at natt-kampene har startet). Dette er midt i det gamle hullet.
        const kl0400 = new Date(kveld * DAG + 4 * 3600e3).toISOString()
        await loggInn(context, 'alice', kl0400)

        await page.goto('/')

        await expect(page.getByText('Natten som var', { exact: true })).toBeVisible()
        await expect(page.getByText('3–1')).toBeVisible()
    })

    test('ettermiddag (14:00): ingen «Natten som var»', async ({ context, page }) => {
        const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })
        await seedBet({ user_id: alice.id, match_num: kveldKamp.match_num, home_score: 2, away_score: 0 })
        const kl1400 = new Date(kveld * DAG + 14 * 3600e3).toISOString()
        await loggInn(context, 'alice', kl1400)

        await page.goto('/')

        await expect(page.getByText('Neste kampdag', { exact: true })).toBeVisible()
        await expect(page.getByText('Natten som var', { exact: true })).toHaveCount(0)
        await expect(page.getByText('2–0')).toBeVisible()
    })
})
