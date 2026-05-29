import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'

import { seedBet, seedUser, truncateAll } from '../support/db'
import { testKamper } from '../support/matches'
import { erNorgeKamp } from '../../src/data/matches'
import type { Match } from '../../src/types/types'

// Ende-til-ende: fire brukere spiller gjennom to gruppespillsrunder og en
// sluttspillrunde. Test-klokka flyttes fremover mellom rundene, resultater
// settes, og leaderboarden verifiseres mot håndregnede poengsummer etter hver
// runde. «alice» tipper via UI; «bob/carol/dave» seedes i DB (hybrid).

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

// --- Kamputvalg, utledet fra kampprogrammet (ikke hardkodede kampnummer) ---
const alleKamper = testKamper()
const gruppeRunde1 = alleKamper.filter((m) => m.round === 1)
const norgeKamp = gruppeRunde1.find((m) => erNorgeKamp(m.home_team, m.away_team))!
const [r1a, r1b] = gruppeRunde1.filter((m) => m !== norgeKamp)
const [r2a, r2b] = alleKamper.filter((m) => m.round === 2)
// Sluttspill-lag er ukjent i datasettet (tomme) til de er avgjort — testen setter
// derfor team-override (HJE/BOR) på round 4-kampen før den tippes.
const r4 = { ...alleKamper.filter((m) => m.round === 4)[0], home_team: 'HJE', away_team: 'BOR' }

// --- Test-klokke: faste tidspunkt rundt de utvalgte kampene ---
const FØR_TURNERING = '2026-06-01T00:00:00.000Z'
function likeEtter(...kamper: Match[]): string {
    const siste = Math.max(...kamper.map((m) => new Date(m.game_start).getTime()))
    return new Date(siste + 3 * 60 * 60 * 1000).toISOString()
}
const ETTER_RUNDE_1 = likeEtter(r1a, r1b, norgeKamp)
const ETTER_RUNDE_2 = likeEtter(r2a, r2b)
const ETTER_RUNDE_4 = likeEtter(r4)

type Spiller = 'alice' | 'bob' | 'carol' | 'dave'
interface Tips {
    hjemme: number
    borte: number
    joker?: boolean
}
interface KampOppsett {
    kamp: Match
    resultat: { hjemme: number; borte: number }
    tips: Record<Spiller, Tips>
}

// Tipsene er valgt så hver delsum er entydig — ingen poenglikhet på
// leaderboarden, slik at radrekkefølgen kan verifiseres direkte.
// Kampvekting: gruppespill = 1, Round of 32 = 2. Med fire tippere pr. kamp
// betaler «riktig utfall» alltid vekting (minste andel er 25 % — over alle
// utfallstrinnene), og i dette scenarioet traff alltid to av fire det eksakte
// resultatet (50 %) → vekting. (Alene-treff hadde gitt vekting × 5.)
const SCENARIO: KampOppsett[] = [
    {
        kamp: r1a,
        resultat: { hjemme: 2, borte: 1 },
        tips: {
            alice: { hjemme: 2, borte: 1, joker: true },
            bob: { hjemme: 2, borte: 1 },
            carol: { hjemme: 1, borte: 0 },
            dave: { hjemme: 0, borte: 2 },
        },
    },
    {
        kamp: r1b,
        resultat: { hjemme: 0, borte: 0 },
        tips: {
            alice: { hjemme: 1, borte: 1 },
            bob: { hjemme: 0, borte: 0 },
            carol: { hjemme: 0, borte: 0 },
            dave: { hjemme: 1, borte: 1 },
        },
    },
    {
        kamp: norgeKamp,
        resultat: { hjemme: 1, borte: 2 },
        tips: {
            alice: { hjemme: 1, borte: 2 },
            bob: { hjemme: 0, borte: 2 },
            carol: { hjemme: 1, borte: 2 },
            dave: { hjemme: 1, borte: 1 },
        },
    },
    {
        kamp: r2a,
        resultat: { hjemme: 2, borte: 0 },
        tips: {
            alice: { hjemme: 2, borte: 0 },
            bob: { hjemme: 2, borte: 0 },
            carol: { hjemme: 1, borte: 0 },
            dave: { hjemme: 3, borte: 1 },
        },
    },
    {
        kamp: r2b,
        resultat: { hjemme: 1, borte: 3 },
        tips: {
            alice: { hjemme: 0, borte: 1 },
            bob: { hjemme: 1, borte: 3 },
            carol: { hjemme: 0, borte: 2 },
            dave: { hjemme: 1, borte: 3 },
        },
    },
    {
        kamp: r4,
        resultat: { hjemme: 2, borte: 1 },
        tips: {
            alice: { hjemme: 2, borte: 1, joker: true },
            bob: { hjemme: 1, borte: 0 },
            carol: { hjemme: 2, borte: 1 },
            dave: { hjemme: 0, borte: 0 },
        },
    },
]

const runde1 = SCENARIO.slice(0, 3)
const runde2 = SCENARIO.slice(3, 5)
const runde4 = SCENARIO.slice(5, 6)

// Forventede leaderboards. Se utregningen pr. kamp i SCENARIO-kommentaren.
// Runde 1: alice 4+1+4, bob 2+2+2, carol 1+2+4, dave 0+1+0.
const FORVENTET_ETTER_R1 = [
    { navn: 'alice', poeng: '9' },
    { navn: 'carol', poeng: '7' },
    { navn: 'bob', poeng: '6' },
    { navn: 'dave', poeng: '1' },
]
// Runde 2 legger til: alice +3, bob +4, carol +2, dave +3.
const FORVENTET_ETTER_R2 = [
    { navn: 'alice', poeng: '12' },
    { navn: 'bob', poeng: '10' },
    { navn: 'carol', poeng: '9' },
    { navn: 'dave', poeng: '4' },
]
// Round of 32 (vekting 2) legger til: alice (2+2)×2joker=8, bob 2, carol 4, dave 0.
const FORVENTET_ETTER_R4 = [
    { navn: 'alice', poeng: '20' },
    { navn: 'carol', poeng: '13' },
    { navn: 'bob', poeng: '12' },
    { navn: 'dave', poeng: '4' },
]

async function settKlokke(context: BrowserContext, iso: string): Promise<void> {
    await context.addCookies([{ name: 'betpool_test_clock', value: iso, url: URL_BASE }])
}

// BetView setter score via +/- -knapper (ingen direkte inntasting). Fra tom
// score: ett «Øk» gir 1, så «Øk» opp til målet, og ett «Reduser» for å nå 0.
async function settScoreMedKnapper(kort: Locator, lag: string, mål: number): Promise<void> {
    const øk = kort.getByRole('button', { name: `Øk ${lag}`, exact: true })
    await øk.click()
    for (let i = 1; i < mål; i++) {
        await øk.click()
    }
    if (mål === 0) {
        await kort.getByRole('button', { name: `Reduser ${lag}`, exact: true }).click()
    }
}

async function tippKampViaUi(page: Page, kamp: Match, tips: Tips): Promise<void> {
    const kort = page.getByTestId(`bet-${kamp.match_num}`)
    await settScoreMedKnapper(kort, kamp.home_team, tips.hjemme)
    await settScoreMedKnapper(kort, kamp.away_team, tips.borte)
    await kort.getByRole('button', { name: 'Lagre', exact: true }).click()
    // Etter lagring forsvinner Lagre-knappen — tipset er i sync med DB.
    await expect(kort.getByRole('button', { name: 'Lagre', exact: true })).toHaveCount(0)
    if (tips.joker) {
        await kort.getByRole('button', { name: 'Bruk joker' }).click()
        await expect(kort.getByText('Joker aktiv — kampen teller dobbelt')).toBeVisible()
    }
}

async function settResultatViaUi(page: Page, kamp: Match, hjemme: number, borte: number): Promise<void> {
    const kort = page.getByTestId(`kamp-${kamp.match_num}`)
    const felt = kort.locator('input')
    await felt.first().fill(String(hjemme))
    await felt.nth(1).fill(String(borte))
    await kort.getByRole('button', { name: 'Lagre', exact: true }).click()
    await expect(kort.getByRole('button', { name: 'Lagre', exact: true })).toHaveCount(0)
}

async function lesLeaderboard(page: Page): Promise<{ navn: string; poeng: string }[]> {
    await page.goto('/leaderboard')
    const rader = page.locator('tbody tr')
    await expect(rader.first()).toBeVisible()
    const ut: { navn: string; poeng: string }[] = []
    for (let i = 0; i < (await rader.count()); i++) {
        const celler = rader.nth(i).locator('td')
        ut.push({
            navn: (await celler.nth(2).innerText()).trim(),
            poeng: (await celler.nth(3).innerText()).trim(),
        })
    }
    return ut
}

test.beforeEach(async () => {
    await truncateAll()
})

test('full gjennomspilling: tipping, tid fremover, resultater og leaderboard', async ({ context, page }) => {
    test.setTimeout(300_000)

    // Klokke-instantene må ligge mellom rundene.
    expect(new Date(ETTER_RUNDE_1).getTime()).toBeLessThan(new Date(r2a.game_start).getTime())
    expect(new Date(ETTER_RUNDE_2).getTime()).toBeLessThan(new Date(r4.game_start).getTime())

    // alice er protagonist og scoreadmin (setter resultater selv). Alle får et
    // vinnertips ulikt winner.ts («») så vinnerbonusen holdes utenfor — testen
    // verifiserer ren kamp-scoring.
    const vinnerTips = { winner: 'Argentina' }
    const alice = await seedUser({
        firebase_user_id: 'alice',
        name: 'alice',
        paid: true,
        scoreadmin: true,
        ...vinnerTips,
    })
    const bob = await seedUser({ firebase_user_id: 'bob', name: 'bob', paid: true, ...vinnerTips })
    const carol = await seedUser({ firebase_user_id: 'carol', name: 'carol', paid: true, ...vinnerTips })
    const dave = await seedUser({ firebase_user_id: 'dave', name: 'dave', paid: true, ...vinnerTips })
    const idTil: Record<Spiller, string> = { alice: alice.id, bob: bob.id, carol: carol.id, dave: dave.id }

    // bob/carol/dave sine tips seedes rett i DB.
    for (const oppsett of SCENARIO) {
        for (const spiller of ['bob', 'carol', 'dave'] as const) {
            const t = oppsett.tips[spiller]
            await seedBet({
                user_id: idTil[spiller],
                match_num: oppsett.kamp.match_num,
                home_score: t.hjemme,
                away_score: t.borte,
                joker: t.joker,
            })
        }
    }

    // Logg inn som alice; klokka starter før turneringen.
    await context.addCookies([
        { name: 'betpool_test_user', value: 'alice', url: URL_BASE },
        { name: 'betpool_test_clock', value: FØR_TURNERING, url: URL_BASE },
    ])

    await test.step('Runde 1 – alice tipper via UI', async () => {
        await page.goto('/my-bets')
        for (const o of runde1) {
            await tippKampViaUi(page, o.kamp, o.tips.alice)
        }
        // Norge-kampen teller dobbelt og kan ikke jokres.
        const norgeKort = page.getByTestId(`bet-${norgeKamp.match_num}`)
        await expect(norgeKort.getByText('Norge ×2')).toBeVisible()
        await expect(norgeKort.getByRole('button', { name: 'Bruk joker' })).toHaveCount(0)
    })

    await test.step('Tiden går fremover – runde 1 låses', async () => {
        await settKlokke(context, ETTER_RUNDE_1)
        await page.goto('/my-bets')
        // De spilte kampene er borte fra «Mine kamper».
        for (const o of runde1) {
            await expect(page.getByTestId(`bet-${o.kamp.match_num}`)).toHaveCount(0)
        }
        // API-et avviser endring av tips og joker etter kampstart.
        const endreTips = await page.request.put(`${URL_BASE}/api/v1/me/bets/${r1a.match_num}`, {
            data: JSON.stringify({ home_score: 3, away_score: 3 }),
        })
        expect(endreTips.status()).toBe(403)
        const settJoker = await page.request.put(`${URL_BASE}/api/v1/me/bets/${r1a.match_num}/joker`, {
            data: JSON.stringify({ joker: true }),
        })
        expect(settJoker.status()).toBe(403)
    })

    await test.step('Runde 1 – resultater settes', async () => {
        await page.goto('/resultatservice')
        for (const o of runde1) {
            await settResultatViaUi(page, o.kamp, o.resultat.hjemme, o.resultat.borte)
        }
    })

    await test.step('Leaderboard stemmer etter runde 1', async () => {
        expect(await lesLeaderboard(page)).toEqual(FORVENTET_ETTER_R1)
    })

    await test.step('Runde 2 – alice tipper via UI', async () => {
        await page.goto('/my-bets')
        for (const o of runde2) {
            await tippKampViaUi(page, o.kamp, o.tips.alice)
        }
    })

    await test.step('Runde 2 – tid fremover og resultater', async () => {
        await settKlokke(context, ETTER_RUNDE_2)
        await page.goto('/resultatservice')
        for (const o of runde2) {
            await settResultatViaUi(page, o.kamp, o.resultat.hjemme, o.resultat.borte)
        }
    })

    await test.step('Leaderboard stemmer etter runde 2', async () => {
        expect(await lesLeaderboard(page)).toEqual(FORVENTET_ETTER_R2)
    })

    await test.step('Round of 32 – sett lag og alice tipper med joker', async () => {
        // Sluttspill-lagene er tomme i datasettet; scoreadmin (alice) setter dem
        // via override så kampen kan tippes.
        const settLag = await page.request.put(`${URL_BASE}/api/v1/matches/${r4.match_num}`, {
            data: JSON.stringify({ home_team: r4.home_team, away_team: r4.away_team }),
        })
        expect(settLag.ok()).toBeTruthy()

        await page.goto('/my-bets')
        for (const o of runde4) {
            await tippKampViaUi(page, o.kamp, o.tips.alice)
        }
    })

    await test.step('Round of 32 – tid fremover og resultat', async () => {
        await settKlokke(context, ETTER_RUNDE_4)
        await page.goto('/resultatservice')
        for (const o of runde4) {
            await settResultatViaUi(page, o.kamp, o.resultat.hjemme, o.resultat.borte)
        }
    })

    await test.step('Leaderboard stemmer etter sluttspillrunden', async () => {
        expect(await lesLeaderboard(page)).toEqual(FORVENTET_ETTER_R4)
    })

    await test.step('Kampsiden viser dobbel kampvekting og joker', async () => {
        await page.goto(`/match/${r4.match_num}`)
        // Round of 32 har kampvekting 2.
        await expect(page.getByText('2 poeng for riktig utfall')).toBeVisible()
        await expect(page.getByText('2 poeng for riktig resultat')).toBeVisible()
        // alice jokret kampen: 4 basispoeng dobles til 8.
        await expect(page.getByText('Joker ×2')).toBeVisible()
        await expect(page.getByText('+8 poeng')).toBeVisible()
    })
})
