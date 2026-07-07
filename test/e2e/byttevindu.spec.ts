import { test, expect, type BrowserContext } from '@playwright/test'

import { seedPlayer, seedUser, truncateAll, withDb } from '../support/db'
import { testKamper } from '../support/matches'

// Byttevinduet: mellom starten på runde 2 og starten på kvartfinalen (runde 6)
// kan brukeren endre vinner/toppscorer én gang mot halverte poeng. Dekker
// info-popupen, at et bytte krever eksplisitt bekreftelse (ikke window.confirm),
// og at bytte blir synlig i «Alle tips».

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

const alleKamper = testKamper()
const forsteKampstart = (round: number) =>
    Math.min(...alleKamper.filter((m) => m.round === round).map((m) => new Date(m.game_start).getTime()))

const I_BYTTEVINDUET = new Date(forsteKampstart(2) + 3 * 60 * 60 * 1000).toISOString()

async function loggInn(context: BrowserContext, fid: string, klokke: string): Promise<void> {
    await context.addCookies([
        { name: 'betpool_test_user', value: fid, url: URL_BASE },
        { name: 'betpool_test_clock', value: klokke, url: URL_BASE },
    ])
}

test.beforeEach(async () => {
    await truncateAll()
})

test('byttevindu: popup vises én gang, bytte krever bekreftelse, og blir synlig i alle-tips', async ({
    context,
    page,
}) => {
    await seedPlayer({ id: 50, name: 'Erling Haaland', team_tla: 'NOR' })
    await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true, winner: 'ARG', topscorer_player_id: 50 })
    await loggInn(context, 'alice', I_BYTTEVINDUET)

    await page.goto('/')

    // Info-popupen vises i byttevinduet, og forsvinner permanent (localStorage) etter «Skjønner».
    await expect(page.getByText('Byttevinduet er åpent')).toBeVisible()
    await page.getByRole('button', { name: 'Skjønner' }).click()
    await expect(page.getByText('Byttevinduet er åpent')).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Byttevinduet er åpent')).toHaveCount(0)

    const vinnerKort = page.locator('div.space-y-1').filter({ hasText: 'Hvem løfter pokalen?' })

    // Å velge et nytt lag åpner bekreftelsesmodalen — lagrer ikke direkte.
    await vinnerKort.getByRole('combobox', { name: 'Velg verdensmester' }).selectOption('BRA')
    await expect(page.getByText('Lås inn dette bytte?')).toBeVisible()

    // Avbryt skal ikke endre noe i DB.
    await page.getByRole('button', { name: 'Avbryt' }).click()
    await expect(page.getByText('Lås inn dette bytte?')).toHaveCount(0)
    const førAvbrutt = await withDb((c) =>
        c.query('SELECT winner, winner_endret FROM users WHERE firebase_user_id = $1', ['alice']),
    )
    expect(førAvbrutt.rows[0]).toMatchObject({ winner: 'ARG', winner_endret: false })

    // Bytt på nytt og bekreft denne gangen.
    await vinnerKort.getByRole('combobox', { name: 'Velg verdensmester' }).selectOption('BRA')
    await expect(page.getByText('Lås inn dette bytte?')).toBeVisible()
    await page.getByRole('button', { name: 'Bytt og lås' }).click()
    await expect(page.getByText('Lås inn dette bytte?')).toHaveCount(0)

    await expect(vinnerKort.getByText('½')).toBeVisible()

    const lagret = await withDb((c) =>
        c.query('SELECT winner, winner_endret, winner_forrige FROM users WHERE firebase_user_id = $1', ['alice']),
    )
    expect(lagret.rows[0]).toMatchObject({ winner: 'BRA', winner_endret: true, winner_forrige: 'ARG' })

    // Feed-posten for byttet er opprettet.
    const feedPost = await withDb((c) => c.query(`SELECT bytte_type FROM feed_posts WHERE kind = 'bytte'`))
    expect(feedPost.rows).toHaveLength(1)
    expect(feedPost.rows[0].bytte_type).toBe('vinner')

    // «Alle tips» viser bytte-banneret.
    await page.goto('/alle-tips')
    await expect(page.getByText(/har byttet tips siden byttevinduet åpnet/)).toBeVisible()
})
