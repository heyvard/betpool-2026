import { test, expect } from '@playwright/test'

import { seedUser, truncateAll } from '../support/db'

const PORT = Number(process.env.TEST_PORT ?? 3100)

test.beforeEach(async () => {
    await truncateAll()
})

test('cookie-identitet logger inn som valgt bruker uten Firebase', async ({ context, page }) => {
    await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
    await context.addCookies([{ name: 'betpool_test_user', value: 'alice', url: `http://localhost:${PORT}` }])

    await page.goto('/')

    // Brukervelgeren viser den aktive test-brukeren …
    await expect(page.getByRole('button', { name: 'alice' })).toBeVisible()
    // … og vi er forbi «velg bruker»-skjermen.
    await expect(page.getByText('Velg en test-bruker')).toHaveCount(0)
})

test('brukervelgeren bytter aktiv bruker', async ({ page }) => {
    await seedUser({ firebase_user_id: 'alice', name: 'Alice' })
    await seedUser({ firebase_user_id: 'bob', name: 'Bob' })

    await page.goto('/')
    // Ingen bruker valgt ennå
    await expect(page.getByText('Velg en test-bruker')).toBeVisible()

    await page.getByRole('button', { name: 'velg test-bruker' }).click()
    await page.getByRole('button', { name: /Bob/ }).click()

    // Siden lastes på nytt som Bob
    await expect(page.getByRole('button', { name: 'bob' })).toBeVisible()
    await expect(page.getByText('Velg en test-bruker')).toHaveCount(0)
})
