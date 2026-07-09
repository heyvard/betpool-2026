import { test, expect, type BrowserContext } from '@playwright/test'

import { seedPlayer, seedUser, truncateAll, withDb } from '../support/db'

// Superadmin-verktøyet /manglende-tips: sette vinner/toppscorer for en bruker
// som ikke har tippet selv. Skal alltid sette *_endret = true samtidig, slik
// at kategorien telles med halvt poeng (samme flagg som byttevinduet bruker).

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

async function loggInn(context: BrowserContext, fid: string): Promise<void> {
    await context.addCookies([{ name: 'betpool_test_user', value: fid, url: URL_BASE }])
}

test.beforeEach(async () => {
    await truncateAll()
})

test('superadmin kan sette manglende vinner/toppscorer, og det gir halvt poeng', async ({ context, page }) => {
    await seedPlayer({ id: 50, name: 'Erling Haaland', team_tla: 'NOR' })
    await seedUser({ firebase_user_id: 'super', name: 'Super', superadmin: true, paid: true })
    await seedUser({ firebase_user_id: 'bob', name: 'Bob', paid: true })
    await loggInn(context, 'super')

    await page.goto('/manglende-tips')

    const bobRad = page.locator('div.bp-card').filter({ hasText: 'Bob' })
    await expect(bobRad.getByText('Velg vinner …')).toBeVisible()

    // Bytt til «Alle» først, slik at Bob-raden ikke forsvinner underveis når
    // «Kun manglende»-filteret ellers ville skjult ham idet begge felt er satt.
    await page.getByRole('button', { name: 'Alle' }).click()

    await bobRad.getByRole('combobox', { name: 'Sett vinner-tips' }).selectOption('BRA')
    await expect(bobRad.getByText('Brasil')).toBeVisible()
    await expect(bobRad.getByText('½')).toHaveCount(1)

    await bobRad.getByRole('button', { name: 'Velg toppscorer …' }).click()
    await page.getByRole('button', { name: /Erling Haaland/ }).click()
    await expect(bobRad.getByText('Erling Haaland')).toBeVisible()
    await expect(bobRad.getByText('½')).toHaveCount(2)

    const rad = await withDb((c) =>
        c.query(
            `SELECT winner, winner_endret, topscorer_player_id, topscorer_endret FROM users WHERE firebase_user_id = $1`,
            ['bob'],
        ),
    )
    expect(rad.rows[0]).toMatchObject({
        winner: 'BRA',
        winner_endret: true,
        topscorer_player_id: 50,
        topscorer_endret: true,
    })

    // «Kun manglende»-filteret skjuler nå Bob siden begge tipsene er satt.
    await page.getByRole('button', { name: 'Kun manglende' }).click()
    await expect(page.getByText('Bob')).toHaveCount(0)
})
