import { test, expect, type Locator, type Page } from '@playwright/test'

import { seedUser, truncateAll } from '../support/db'
import { testKamper } from '../support/matches'
import { erNorgeKamp } from '../../src/data/matches'

// Fokuserte tester for den nye stepper- og autolagrings-logikken i BetView.
// Kjører mot den ekte test-stacken (PGlite + next start), så autolagring,
// debounce og refetch testes slik de faktisk oppfører seg — ikke mot mocks.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`
const FØR_TURNERING = '2026-06-01T00:00:00.000Z'

// En åpen gruppekamp (ikke Norge, for å unngå ×2/joker-støy). Klokka står før
// turneringen, så kampen er ikke startet → kortet er redigerbart.
const åpenKamp = testKamper().find((m) => m.round === 1 && !erNorgeKamp(m.home_team, m.away_team))!
const HJEMME = åpenKamp.home_team
const BORTE = åpenKamp.away_team

function kort(page: Page): Locator {
    return page.getByTestId(`bet-${åpenKamp.match_num}`)
}
const øk = (k: Locator, lag: string) => k.getByRole('button', { name: `Øk ${lag}`, exact: true })
const reduser = (k: Locator, lag: string) => k.getByRole('button', { name: `Reduser ${lag}`, exact: true })
const felt = (k: Locator, lag: string) => k.getByRole('spinbutton', { name: `Score for ${lag}`, exact: true })

test.beforeEach(async ({ context }) => {
    await truncateAll()
    await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })
    await context.addCookies([
        { name: 'betpool_test_user', value: 'alice', url: URL_BASE },
        { name: 'betpool_test_clock', value: FØR_TURNERING, url: URL_BASE },
    ])
})

test('stepper: + fra tom gir 0, og − er deaktivert når feltet er tomt eller på 0', async ({ page }) => {
    await page.goto('/my-bets')
    const k = kort(page)
    const f = felt(k, HJEMME)

    await expect(f).toHaveValue('')
    // − gir ingen mening fra tom — den er deaktivert.
    await expect(reduser(k, HJEMME)).toBeDisabled()

    // + fra tom lander på 0 (ikke 1).
    await øk(k, HJEMME).click()
    await expect(f).toHaveValue('0')
    // På 0 kan vi ikke gå lenger ned — blir værende på 0.
    await expect(reduser(k, HJEMME)).toBeDisabled()

    // + igjen → 1, og nå kan vi redusere tilbake til 0.
    await øk(k, HJEMME).click()
    await expect(f).toHaveValue('1')
    await reduser(k, HJEMME).click()
    await expect(f).toHaveValue('0')
    await expect(reduser(k, HJEMME)).toBeDisabled()
})

test('maks score er 9 — stepperen stopper og + deaktiveres på 9', async ({ page }) => {
    await page.goto('/my-bets')
    const k = kort(page)
    const f = felt(k, HJEMME)
    const øP = øk(k, HJEMME)

    await øP.click() // tom → 0
    for (let i = 0; i < 9; i++) await øP.click() // 0 → 9
    await expect(f).toHaveValue('9')
    // På taket er + deaktivert — stepperen kan ikke gå høyere.
    await expect(øP).toBeDisabled()
})

test('direkte tasting fungerer, og tallfeltet godtar ikke verdier over 9', async ({ page }) => {
    await page.goto('/my-bets')
    const k = kort(page)
    const f = felt(k, HJEMME)

    await expect(f).toHaveAttribute('max', '9')

    await f.fill('7')
    await expect(f).toHaveValue('7')

    // Forsøk på 12 avvises av onChange — verdien blir stående på 7.
    await f.fill('12')
    await expect(f).toHaveValue('7')
})

test('autolagring: et komplett tips lagres uten Lagre-knapp', async ({ page }) => {
    await page.goto('/my-bets')
    const k = kort(page)

    // Ingen Lagre-knapp lenger.
    await expect(k.getByRole('button', { name: 'Lagre' })).toHaveCount(0)

    await felt(k, HJEMME).fill('2')
    // Bare ett felt fylt → ingenting lagres ennå, ingen «Fjern tips».
    await expect(k.getByRole('button', { name: 'Fjern tips', exact: true })).toHaveCount(0)

    await felt(k, BORTE).fill('1')
    // Begge fylt → autolagring ~800 ms senere: «Lagret» + «Fjern tips» dukker opp.
    await expect(k.getByText('Lagret')).toBeVisible()
    await expect(k.getByRole('button', { name: 'Fjern tips', exact: true })).toBeVisible()
})

test('hver lagring kan angres og ruller tilbake til forrige lagrede verdi', async ({ page }) => {
    await page.goto('/my-bets')
    const k = kort(page)

    await felt(k, HJEMME).fill('2')
    await felt(k, BORTE).fill('1')
    await expect(k.getByText('Lagret')).toBeVisible()

    // Endre hjemmescore → ny autolagring med angre-mulighet.
    await felt(k, HJEMME).fill('3')
    await expect(k.getByText(/Endret til 3.1/)).toBeVisible()

    // Angre ruller tilbake til forrige lagrede verdi (2–1).
    await k.getByRole('button', { name: 'Angre', exact: true }).click()
    await expect(felt(k, HJEMME)).toHaveValue('2')
    await expect(felt(k, BORTE)).toHaveValue('1')
})

test('Fjern tips tømmer tipset, og handlingen kan angres', async ({ page }) => {
    await page.goto('/my-bets')
    const k = kort(page)

    await felt(k, HJEMME).fill('2')
    await felt(k, BORTE).fill('1')
    await expect(k.getByRole('button', { name: 'Fjern tips', exact: true })).toBeVisible()

    await k.getByRole('button', { name: 'Fjern tips', exact: true }).click()
    await expect(felt(k, HJEMME)).toHaveValue('')
    await expect(felt(k, BORTE)).toHaveValue('')
    await expect(k.getByText('Tips fjernet')).toBeVisible()

    // Angre gjenoppretter tipset.
    await k.getByRole('button', { name: 'Angre', exact: true }).click()
    await expect(felt(k, HJEMME)).toHaveValue('2')
    await expect(felt(k, BORTE)).toHaveValue('1')
})
