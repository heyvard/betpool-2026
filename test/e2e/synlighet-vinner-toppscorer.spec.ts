import { test, expect, type BrowserContext } from '@playwright/test'

import { seedUser, seedPlayer, truncateAll } from '../support/db'
import { testKamper } from '../support/matches'

// Kjernegarantien for de første dagene: ingen ser andres VM-vinner eller
// toppscorer før fristen (starten på runde 2). /api/v1/stats returnerer en tom
// fordeling så lenge erIFørsteRunde er sann, og hele fordelingen etterpå. Her
// seedes samme data, og bare test-klokka flyttes — synligheten skal flippe.
// Konsumenten er /alle-tips (samme garanti som /api/v1/bets).

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

const forsteR2 = Math.min(
    ...testKamper()
        .filter((m) => m.round === 2)
        .map((m) => new Date(m.game_start).getTime()),
)
const FØR_TURNERING = '2026-06-01T00:00:00.000Z'
const ETTER_FRIST = new Date(forsteR2 + 3 * 60 * 60 * 1000).toISOString()

async function loggInn(context: BrowserContext, fid: string, klokke: string): Promise<void> {
    await context.addCookies([
        { name: 'betpool_test_user', value: fid, url: URL_BASE },
        { name: 'betpool_test_clock', value: klokke, url: URL_BASE },
    ])
}

test.beforeEach(async () => {
    await truncateAll()
    // bob har tippet; alice er innlogget tilskuer.
    await seedUser({ firebase_user_id: 'alice', name: 'alice', paid: true })
    await seedPlayer({ id: 21, name: 'Kylian Mbappé', team_tla: 'FRA' })
    await seedUser({
        firebase_user_id: 'bob',
        name: 'bob',
        paid: true,
        winner: 'ARG',
        topscorer_player_id: 21,
    })
})

test('andre brukeres vinner og toppscorer er skjult før runde 2', async ({ context, page }) => {
    await loggInn(context, 'alice', FØR_TURNERING)

    await page.goto('/alle-tips')
    // Fordelingen er tom så lenge tipsene er hemmelige.
    await expect(page.getByText('Ingen i ligaen har tippet ennå.')).toBeVisible()
    await expect(page.getByText('Argentina')).toHaveCount(0)
    await expect(page.getByText('Kylian Mbappé')).toHaveCount(0)
})

test('andre brukeres vinner og toppscorer blir synlige etter runde 2-fristen', async ({ context, page }) => {
    await loggInn(context, 'alice', ETTER_FRIST)

    await page.goto('/alle-tips')
    await expect(page.getByText('Argentina')).toBeVisible()

    await page.getByRole('button', { name: 'Toppscorer' }).click()
    await expect(page.getByText('Kylian Mbappé')).toBeVisible()
})
