import { test, expect } from '@playwright/test'

import { seedUser, truncateAll, seedSyncedScore, seedSyncedKnockoutScore, setMatchStatus, withDb } from '../support/db'

async function settLag(matchNum: number, home: string, away: string): Promise<void> {
    await withDb((c) =>
        c.query(`UPDATE matches SET home_team = $1, away_team = $2 WHERE match_num = $3`, [home, away, matchNum]),
    )
}

// /bracket viser sluttspill-treet. Kampoppsettet (inkl. utslagskampene) ligger
// allerede i `matches`-tabellen fra migreringen, så vi trenger bare en innlogget
// bruker + ev. en score for å sjekke at resultatet vises.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

// En R32-kamp som har lag satt i datasettet (RSA–CAN, match_num 537417).
const R32_MED_LAG = 537417

test.beforeEach(async ({ context }) => {
    await truncateAll()
    await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })
    await context.addCookies([{ name: 'betpool_test_user', value: 'alice', url: URL_BASE }])
})

test('bracket viser nodene og lenker til kampsiden', async ({ page }) => {
    await page.goto('/bracket')

    // Kolonne-overskriftene for runde-treet.
    await expect(page.getByText('1/16', { exact: true })).toBeVisible()
    await expect(page.getByText('Finale', { exact: true })).toBeVisible()

    // Hver node er en lenke til /match/[match_num].
    const node = page.locator(`a[href="/match/${R32_MED_LAG}"]`)
    await expect(node).toBeVisible()

    // Klikk på noden navigerer til kampsiden.
    await node.click()
    await expect(page).toHaveURL(new RegExp(`/match/${R32_MED_LAG}$`))
})

test('ferdigspilt kamp viser resultat i bracketen', async ({ page }) => {
    await seedSyncedScore(R32_MED_LAG, 2, 1)
    await setMatchStatus(R32_MED_LAG, 'FINISHED')

    await page.goto('/bracket')

    const node = page.locator(`a[href="/match/${R32_MED_LAG}"]`)
    await expect(node).toContainText('2')
    await expect(node).toContainText('1')
    // Ferdigspilt → grønn status-stripe til venstre i noden.
    await expect(node.locator('span.bg-green-500')).toBeVisible()
})

test('kamp avgjort på straffer viser STR-resultatlinje med totalen', async ({ page }) => {
    await seedSyncedKnockoutScore({
        matchNum: R32_MED_LAG,
        ftHome: 1,
        ftAway: 1,
        rtHome: 1,
        rtAway: 1,
        etHome: 0,
        etAway: 0,
        penHome: 2,
        penAway: 4,
        duration: 'PENALTY_SHOOTOUT',
        winner: 'AWAY_TEAM',
    })
    await setMatchStatus(R32_MED_LAG, 'FINISHED')

    await page.goto('/bracket')

    const node = page.locator(`a[href="/match/${R32_MED_LAG}"]`)
    // Footer navngir straffene (str 2–4), ikke 90-min-stillingen (som står i radene).
    await expect(node).toContainText('str')
    await expect(node).toContainText('2–4')
})

test('kamp avgjort i ekstraomganger viser E.O.-resultatlinje med 120-min-totalen', async ({ page }) => {
    await seedSyncedKnockoutScore({
        matchNum: R32_MED_LAG,
        ftHome: 2,
        ftAway: 1,
        rtHome: 1,
        rtAway: 1,
        etHome: 1,
        etAway: 0,
        duration: 'EXTRA_TIME',
        winner: 'HOME_TEAM',
    })
    await setMatchStatus(R32_MED_LAG, 'FINISHED')

    await page.goto('/bracket')

    const node = page.locator(`a[href="/match/${R32_MED_LAG}"]`)
    await expect(node).toContainText('e.o.')
    await expect(node).toContainText('2–1')
})

test('avleder vinneren inn i neste node når feeder-kampene er ferdige', async ({ page }) => {
    // To R32-kamper (537415, 537416) som mater R16-kamp 537375. R16-kampen har
    // ingen lag satt ennå, men begge R32-kampene er ferdigspilt og avgjort.
    await settLag(537415, 'GER', 'PAR')
    await seedSyncedScore(537415, 2, 0)
    await setMatchStatus(537415, 'FINISHED')
    await settLag(537416, 'FRA', 'SWE')
    await seedSyncedScore(537416, 1, 3)
    await setMatchStatus(537416, 'FINISHED')

    await page.goto('/bracket')

    // R16-noden skal nå vise vinnerne: Tyskland (GER) og Sverige (SWE).
    const r16 = page.locator(`a[href="/match/537375"]`)
    await expect(r16).toContainText('Tyskland')
    await expect(r16).toContainText('Sverige')
})
