import { test, expect } from '@playwright/test'

import { seedUser, truncateAll, seedSyncedScore, setMatchStatus } from '../support/db'

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
