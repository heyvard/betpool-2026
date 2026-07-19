import { test, expect, type BrowserContext } from '@playwright/test'

import { førsteMatchNum, seedBet, seedPlayer, seedUser, truncateAll, withDb } from '../support/db'
import { testKamper } from '../support/matches'

// Superadmin-verktøyet /vinner-toppscorer: registrerer den faktiske
// turneringsfasiten (vinner-lag + ett eller flere toppscorere). Å lagre skal
// gi bonuspoeng til brukere hvis egne tips matcher — uten noe eget lagrings-
// steg for selve poengene (de regnes ut på nytt fra fasiten hver gang).

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

// Winner/topscorer-tips er skjult for andre til runde 2-fristen (erIFørsteRunde)
// — flytt klokka forbi den før vi sjekker ledertavla, ellers maskeres bob sine
// egne tips i /api/v1/bets slik det gjør for alle andre brukere.
const forsteR2 = Math.min(
    ...testKamper()
        .filter((m) => m.round === 2)
        .map((m) => new Date(m.game_start).getTime()),
)
const ETTER_FRIST = new Date(forsteR2 + 3 * 60 * 60 * 1000).toISOString()

async function loggInn(context: BrowserContext, fid: string, klokke?: string): Promise<void> {
    const cookies = [{ name: 'betpool_test_user', value: fid, url: URL_BASE }]
    if (klokke) cookies.push({ name: 'betpool_test_clock', value: klokke, url: URL_BASE })
    await context.addCookies(cookies)
}

test.beforeEach(async () => {
    await truncateAll()
})

test('superadmin kan sette vinner og flere toppscorere, og det lagres', async ({ context, page }) => {
    await seedPlayer({ id: 50, name: 'Erling Haaland', team_tla: 'NOR' })
    await seedPlayer({ id: 51, name: 'Kylian Mbappé', team_tla: 'FRA' })
    await seedUser({ firebase_user_id: 'super', name: 'Super', superadmin: true, paid: true })
    await loggInn(context, 'super')

    await page.goto('/vinner-toppscorer')

    await expect(page.getByText('Ingen registrert ennå.')).toBeVisible()

    await page.getByRole('combobox', { name: 'Sett vinner' }).selectOption('NOR')

    await page.getByRole('button', { name: 'Legg til spiller …' }).click()
    await page.getByRole('button', { name: /Erling Haaland/ }).click()
    await expect(page.getByText('Erling Haaland')).toBeVisible()

    await page.getByRole('button', { name: 'Legg til spiller …' }).click()
    await page.getByRole('button', { name: /Kylian Mbappé/ }).click()
    await expect(page.getByText('Kylian Mbappé')).toBeVisible()

    await page.getByRole('button', { name: 'Lagre' }).click()
    await expect(page.getByText('Lagret')).toBeVisible()

    const fasit = await withDb(async (c) => {
        const vinner = await c.query(`SELECT winner_team_tla FROM tournament_result WHERE id = 'current'`)
        const spillere = await c.query(`SELECT player_id FROM tournament_topscorers ORDER BY player_id`)
        return { winnerTeam: vinner.rows[0].winner_team_tla, topscorerPlayerIds: spillere.rows.map((r) => r.player_id) }
    })
    expect(fasit).toEqual({ winnerTeam: 'NOR', topscorerPlayerIds: [50, 51] })

    // En bruker som har tippet riktig vinner/toppscorer skal nå få bonuspoeng
    // på ledertavla — poengene lagres aldri eksplisitt, de regnes ut fra fasiten.
    const bob = await seedUser({ firebase_user_id: 'bob', name: 'Bob', paid: true, winner: 'NOR' })
    await withDb((c) => c.query(`UPDATE users SET topscorer_player_id = 50 WHERE id = $1`, [bob.id]))
    // calculateLeaderboard summerer bare winner-/toppscorer-bonusen inn i totalen
    // når populasjonen har minst ett kamp-tips — uten tips returneres 0-rader for
    // alle uansett bonus. Seed derfor et tips på en allerede spilt kamp, med en
    // score som garantert ikke matcher det udefinerte (0–0-defaultede) resultatet,
    // slik at kamp-tipset selv ikke bidrar med poeng inn i summen vi sjekker.
    const matchNum = await førsteMatchNum()
    await seedBet({ user_id: bob.id, match_num: matchNum, home_score: 5, away_score: 3 })

    await loggInn(context, 'super', ETTER_FRIST)
    await page.goto('/leaderboard')
    const bobRad = page
        .getByTestId('leaderboard-rad')
        .filter({ has: page.getByTestId('leaderboard-naam').getByText('Bob') })
    // 25 (alene om riktig vinner) + 25 (alene om riktig toppscorer) = 50.
    await expect(bobRad.getByTestId('leaderboard-poeng')).toHaveText('50')

    // Samme bonus skal også reflekteres på Bobs egen /user/[id]-side.
    await page.goto(`/user/${bob.id}`)
    await expect(page.getByText('Norge')).toBeVisible()
    await expect(page.getByText('Erling Haaland')).toBeVisible()
    await expect(page.getByText('+25 poeng')).toHaveCount(2)
})
