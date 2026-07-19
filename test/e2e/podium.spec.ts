import { test, expect, type BrowserContext } from '@playwright/test'

import { seedManualScore, seedBet, seedPlayer, seedUser, truncateAll, withDb } from '../support/db'
import { testKamper } from '../support/matches'

// Pallen: superadmin-knappen på /vinner-toppscorer som poster en feed-post med
// topp-3 i hovedligaen + en (mocket) Claude-skrevet oppsummering av reisen
// deres. ANTHROPIC_MOCK=true (satt som default i testStack.ts) gjør at
// server/feed/podiumAi.ts returnerer deterministisk innhold uten å kalle det
// ekte Anthropic-APIet.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

const kamp = testKamper().filter((m) => m.round === 1)[0]
// Test-klokka må stå etter kampstart, ellers filtrerer hentHovedligaAllBets
// bort tipsene (kampen har ikke «startet» ennå).
const ETTER_KAMPSTART = new Date(new Date(kamp.game_start).getTime() + 3 * 60 * 60 * 1000).toISOString()

async function loggInn(context: BrowserContext, fid: string, klokke?: string): Promise<void> {
    const cookies = [{ name: 'betpool_test_user', value: fid, url: URL_BASE }]
    if (klokke) cookies.push({ name: 'betpool_test_clock', value: klokke, url: URL_BASE })
    await context.addCookies(cookies)
}

test.beforeEach(async () => {
    await truncateAll()
})

test('superadmin kan poste pallen, med topp-3 og AI-oppsummering i feeden', async ({ context, page }) => {
    await seedPlayer({ id: 99, name: 'Erling Haaland', team_tla: 'NOR' })

    const gull = await seedUser({ firebase_user_id: 'gull', name: 'Gullgutten', paid: true, winner: 'NOR' })
    const sølv = await seedUser({ firebase_user_id: 'sølv', name: 'Sølvvinner', paid: true })
    const bronse = await seedUser({ firebase_user_id: 'bronse', name: 'Bronsebrigg', paid: true })
    const super_ = await seedUser({ firebase_user_id: 'super', name: 'Super', superadmin: true, paid: true })
    await withDb((c) => c.query(`UPDATE users SET topscorer_player_id = 99 WHERE id = $1`, [gull.id]))

    // Fasiten — kreves for at pallen skal kunne postes (verifiseringen).
    await withDb((c) => c.query(`UPDATE tournament_result SET winner_team_tla = 'NOR' WHERE id = 'current'`))
    await withDb((c) => c.query(`INSERT INTO tournament_topscorers (player_id) VALUES (99)`))

    // Ett gruppespill-tips: gull traff eksakt, sølv traff kun utfallet, bronse bommet helt.
    await seedManualScore(kamp.match_num, 2, 1)
    await seedBet({ user_id: gull.id, match_num: kamp.match_num, home_score: 2, away_score: 1 })
    await seedBet({ user_id: sølv.id, match_num: kamp.match_num, home_score: 3, away_score: 1 })
    await seedBet({ user_id: bronse.id, match_num: kamp.match_num, home_score: 0, away_score: 2 })

    await loggInn(context, 'super', ETTER_KAMPSTART)
    await page.goto('/vinner-toppscorer')

    await expect(page.getByText('Post pallen i feeden')).toBeVisible()

    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Post pallen i feeden' }).click()
    await expect(page.getByText('Pallen er postet i feeden! 🏆')).toBeVisible()

    const rad = await withDb((c) => c.query(`SELECT kind, tittel, data FROM feed_posts WHERE kind = 'podium'`))
    expect(rad.rowCount).toBe(1)
    const data = rad.rows[0].data as { topp3: { userId: string; plass: number }[] }
    expect(data.topp3.map((s) => s.userId).sort()).toEqual([bronse.id, gull.id, sølv.id].sort())
    expect(data.topp3.find((s) => s.userId === gull.id)?.plass).toBe(1)

    // Idempotent — et nytt trykk skal ikke lage en ny post.
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Post pallen i feeden' }).click()
    await expect(page.getByText('Pallen er allerede postet tidligere.')).toBeVisible()
    const radEtter = await withDb((c) => c.query(`SELECT id FROM feed_posts WHERE kind = 'podium'`))
    expect(radEtter.rowCount).toBe(1)

    await loggInn(context, super_.firebase_user_id, ETTER_KAMPSTART)
    await page.goto('/feed')
    await expect(page.getByText('Pallen er satt').first()).toBeVisible()
    await expect(page.getByText('Gullgutten').first()).toBeVisible()
    await expect(page.getByText('Sølvvinner').first()).toBeVisible()
    await expect(page.getByText('Bronsebrigg').first()).toBeVisible()
    await expect(page.getByText('Vinner:')).toBeVisible()
    await expect(page.getByText('Toppscorer:')).toBeVisible()
    await expect(page.getByText('AI-generert')).toBeVisible()

    await page.screenshot({ path: 'test-results/podium-feed.png', fullPage: true })
})
