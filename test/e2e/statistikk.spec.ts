import { test, expect, type BrowserContext } from '@playwright/test'

import { seedBet, seedManualScore, seedUser, setMatchStatus, truncateAll } from '../support/db'
import { testKamper } from '../support/matches'
import { erNorgeKamp } from '../../src/data/matches'

// De to nye statistikk-sidene («Beste tipp» og «Verdifulle kamper») skal vise
// topplister basert på allerede beregnede poeng, og nås via en ny «Statistikk»-
// undermeny i hovedmenyen.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

const [kamp1, kamp2] = testKamper()
    .filter((m) => m.round === 1 && !erNorgeKamp(m.home_team, m.away_team))
    .slice(0, 2)

const ETTER_BEGGE_KAMPER = new Date(
    Math.max(new Date(kamp1.game_start).getTime(), new Date(kamp2.game_start).getTime()) + 3 * 60 * 60 * 1000,
).toISOString()

async function loggInn(context: BrowserContext, bruker: string): Promise<void> {
    await context.addCookies([
        { name: 'betpool_test_user', value: bruker, url: URL_BASE },
        { name: 'betpool_test_clock', value: ETTER_BEGGE_KAMPER, url: URL_BASE },
    ])
}

test.beforeEach(async () => {
    await truncateAll()
})

test('Beste tipp viser enkelttips sortert etter poeng', async ({ context, page }) => {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })
    const bob = await seedUser({ firebase_user_id: 'bob', name: 'bob' })

    // alice treffer eksakt på begge kamper (høyest poeng), bob bommer på begge.
    await seedBet({ user_id: alice.id, match_num: kamp1.match_num, home_score: 2, away_score: 1 })
    await seedBet({ user_id: bob.id, match_num: kamp1.match_num, home_score: 0, away_score: 0 })
    await seedBet({ user_id: alice.id, match_num: kamp2.match_num, home_score: 1, away_score: 0 })
    await seedBet({ user_id: bob.id, match_num: kamp2.match_num, home_score: 3, away_score: 3 })
    await seedManualScore(kamp1.match_num, 2, 1)
    await seedManualScore(kamp2.match_num, 1, 0)
    await setMatchStatus(kamp1.match_num, 'FINISHED')
    await setMatchStatus(kamp2.match_num, 'FINISHED')

    await loggInn(context, 'alice')
    await page.goto('/statistikk-beste-tips')

    await expect(page.getByText('Beste tipp', { exact: true }).first()).toBeVisible()
    // alices to treff topper lista (høyest poeng øverst).
    await expect(page.locator('a[href^="/match/"]').first()).toContainText('alice')
})

test('Verdifulle kamper viser kampene med mest utdelt poeng', async ({ context, page }) => {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })
    const bob = await seedUser({ firebase_user_id: 'bob', name: 'bob' })

    await seedBet({ user_id: alice.id, match_num: kamp1.match_num, home_score: 2, away_score: 1 })
    await seedBet({ user_id: bob.id, match_num: kamp1.match_num, home_score: 0, away_score: 0 })
    await seedBet({ user_id: alice.id, match_num: kamp2.match_num, home_score: 1, away_score: 0 })
    await seedBet({ user_id: bob.id, match_num: kamp2.match_num, home_score: 3, away_score: 3 })
    await seedManualScore(kamp1.match_num, 2, 1)
    await seedManualScore(kamp2.match_num, 1, 0)
    await setMatchStatus(kamp1.match_num, 'FINISHED')
    await setMatchStatus(kamp2.match_num, 'FINISHED')

    await loggInn(context, 'alice')
    await page.goto('/statistikk-verdifulle-kamper')

    await expect(page.getByText('Verdifulle kamper', { exact: true }).first()).toBeVisible()
    await expect(page.locator(`a[href="/match/${kamp1.match_num}"]`)).toBeVisible()
    await expect(page.locator(`a[href="/match/${kamp2.match_num}"]`)).toBeVisible()
})

test('Beste tipp og Verdifulle kamper lenker til riktig kamp', async ({ context, page }) => {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })

    await seedBet({ user_id: alice.id, match_num: kamp1.match_num, home_score: 2, away_score: 1 })
    await seedManualScore(kamp1.match_num, 2, 1)
    await setMatchStatus(kamp1.match_num, 'FINISHED')

    await loggInn(context, 'alice')
    await page.goto('/statistikk-beste-tips')

    await page.locator('a[href^="/match/"]').first().click()
    await expect(page).toHaveURL(new RegExp(`/match/${kamp1.match_num}$`))

    await page.goto('/statistikk-verdifulle-kamper')
    await page.locator('a[href^="/match/"]').first().click()
    await expect(page).toHaveURL(new RegExp(`/match/${kamp1.match_num}$`))
})
