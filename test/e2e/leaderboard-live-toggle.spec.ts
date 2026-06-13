import { test, expect, type BrowserContext } from '@playwright/test'

import { seedBet, seedSyncedScore, seedUser, setMatchStatus, truncateAll } from '../support/db'
import { testKamper } from '../support/matches'
import { erNorgeKamp } from '../../src/data/matches'

// Ledertavla skal kunne skru av/på poeng fra kamper som pågår. En kamp settes
// IN_PLAY med et live synket delresultat; «alice» har tippet det eksakt og får
// foreløpige poeng. Bryteren skal da dukke opp, totalen vise «LIVE +X», og når
// den skrus av skal de foreløpige poengene forsvinne fra summen.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

// Velg en gruppespillskamp som ikke involverer Norge (unngår ×2-dobling i mattefasiten).
const kamp = testKamper().find((m) => m.round === 1 && !erNorgeKamp(m.home_team, m.away_team))!

// Kampen pågår: klokka står like etter avspark.
const UNDER_KAMP = new Date(new Date(kamp.game_start).getTime() + 60 * 60 * 1000).toISOString()

async function loggInn(context: BrowserContext, bruker: string): Promise<void> {
    await context.addCookies([
        { name: 'betpool_test_user', value: bruker, url: URL_BASE },
        { name: 'betpool_test_clock', value: UNDER_KAMP, url: URL_BASE },
    ])
}

test.beforeEach(async () => {
    await truncateAll()
})

test('foreløpige poeng fra en pågående kamp kan skrus av og på', async ({ context, page }) => {
    test.setTimeout(120_000)

    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })
    const bob = await seedUser({ firebase_user_id: 'bob', name: 'bob', paid: true })

    // alice tipper eksakt det live-resultatet (2–1), bob bommer på utfallet.
    await seedBet({ user_id: alice.id, match_num: kamp.match_num, home_score: 2, away_score: 1 })
    await seedBet({ user_id: bob.id, match_num: kamp.match_num, home_score: 0, away_score: 2 })

    // Kampen pågår med et live synket delresultat 2–1 (ikke admin-satt).
    await setMatchStatus(kamp.match_num, 'IN_PLAY')
    await seedSyncedScore(kamp.match_num, 2, 1)

    await loggInn(context, 'alice')
    await page.goto('/leaderboard')

    const aliceRad = page.locator('tbody tr', { hasText: 'alice' })
    const alicePoeng = aliceRad.locator('td').last()
    await expect(aliceRad).toBeVisible()

    // Bryteren vises fordi det finnes foreløpige poeng, og står PÅ som standard.
    const bryter = page.getByRole('switch')
    await expect(bryter).toBeVisible()
    await expect(bryter).toHaveAttribute('data-state', 'checked')

    // Foreløpige poeng inkludert: gruppespill (vekting 1), alene om eksakt resultat
    // (×5) + riktig utfall (×1) = 6, merket «LIVE +6».
    await expect(alicePoeng.getByText(/LIVE \+6/)).toBeVisible()
    await expect(alicePoeng).toContainText('6')

    // Skru av pågående kamper: de foreløpige poengene forsvinner fra summen.
    await bryter.click()
    await expect(bryter).toHaveAttribute('data-state', 'unchecked')
    await expect(alicePoeng.getByText(/LIVE/)).toHaveCount(0)
    await expect(alicePoeng).toHaveText('0')
})
