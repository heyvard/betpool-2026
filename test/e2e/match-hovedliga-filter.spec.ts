import { test, expect, type BrowserContext, type Page } from '@playwright/test'

import { seedBet, seedUser, truncateAll } from '../support/db'
import { testKamper } from '../support/matches'

// Matchsiden (/match/[id]) viser hovedligaen (Æresligaen). Tips fra brukere som
// har valgt bort hovedligaen (i_hovedliga = false) skal ikke vises i tips-lista
// eller telle med i fordelingen — kun hovedliga-deltakerne.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

// En gruppespillskamp (runde 1) med kjente lag, og et klokkeslett rett etter den
// startet, så tipsene er låst og synlige på matchsiden.
const r1 = testKamper().filter((m) => m.round === 1)[0]
const ETTER_KAMP = new Date(new Date(r1.game_start).getTime() + 3 * 60 * 60 * 1000).toISOString()

async function loggInn(context: BrowserContext, bruker: string): Promise<void> {
    await context.addCookies([
        { name: 'betpool_test_user', value: bruker, url: URL_BASE },
        { name: 'betpool_test_clock', value: ETTER_KAMP, url: URL_BASE },
    ])
}

// Tips-rad-lenker (én per bruker) nederst på matchsiden.
function tipsRader(page: Page) {
    return page.locator('a[href^="/user/"]')
}

test.beforeEach(async () => {
    await truncateAll()
})

test('matchsiden skjuler tips fra brukere som har valgt bort hovedligaen', async ({ context, page }) => {
    // alice + carol er med i hovedligaen, bob har valgt den bort.
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })
    const carol = await seedUser({ firebase_user_id: 'carol', name: 'carol' })
    const bob = await seedUser({ firebase_user_id: 'bob', name: 'bob', i_hovedliga: false })

    await seedBet({ user_id: alice.id, match_num: r1.match_num, home_score: 1, away_score: 0 })
    await seedBet({ user_id: carol.id, match_num: r1.match_num, home_score: 2, away_score: 1 })
    await seedBet({ user_id: bob.id, match_num: r1.match_num, home_score: 0, away_score: 3 })

    await loggInn(context, 'alice')
    await page.goto(`/match/${r1.match_num}`)

    // Tips-lista viser de andre hovedliga-deltakerne (carol), men ikke bob.
    await expect(tipsRader(page).filter({ hasText: 'carol' })).toHaveCount(1)
    await expect(tipsRader(page).filter({ hasText: 'bob' })).toHaveCount(0)

    // Fordelingen («Alle tips») teller kun de to hovedliga-tipsene.
    await expect(page.getByText('Alle tips · 2')).toBeVisible()
})
