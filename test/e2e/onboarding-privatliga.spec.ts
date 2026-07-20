import { test, expect, type Page } from '@playwright/test'

import { seedUser, seedLeague, seedLeagueMember, truncateAll, withDb } from '../support/db'

// Onboarding i en privat liga: en bruker følger en invitasjonslenke og blir med.
// Å bli med i hovedligaen er ikke et valg — alle aktive brukere er automatisk med.
// Testen dekker at brukeren blir medlem av den private ligaen og likevel vises i
// hovedliga-tavla.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

async function loggInn(page: Page, bruker: string): Promise<void> {
    await page.context().addCookies([{ name: 'betpool_test_user', value: bruker, url: URL_BASE }])
}

// Navnene på radene i ledertavla, lest fra data-testid="leaderboard-naam".
async function synligeNavn(page: Page): Promise<string[]> {
    const rader = page.locator('[data-testid="leaderboard-rad"]')
    await expect(rader.first()).toBeVisible()
    const ut: string[] = []
    for (let i = 0; i < (await rader.count()); i++) {
        ut.push((await rader.nth(i).locator('[data-testid="leaderboard-naam"]').innerText()).trim())
    }
    return ut
}

async function hovedligaNavn(page: Page): Promise<string[]> {
    await page.goto('/leaderboard')
    return synligeNavn(page)
}

async function privatligaNavn(page: Page, ligaNavn: string): Promise<string[]> {
    await page.goto('/leaderboard')
    await page.getByTestId('liga-velger-btn').click()
    await page.getByRole('option', { name: ligaNavn }).click()
    return synligeNavn(page)
}

async function erMedlem(ligaId: string, firebaseUserId: string): Promise<boolean> {
    return withDb(async (c) => {
        const r = await c.query<{ status: string }>(
            `SELECT lm.status FROM league_members lm
               JOIN users u ON u.id = lm.user_id
              WHERE lm.league_id = $1 AND u.firebase_user_id = $2`,
            [ligaId, firebaseUserId],
        )
        return r.rows.length > 0 && r.rows[0].status === 'medlem'
    })
}

// Felles oppsett: en eier (alice) med en privat liga «Gutta». Returnerer ligaen
// så testene kan melde nybrukeren inn via invitasjonslenka.
async function seedLigaMedEier() {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })
    const liga = await seedLeague({ name: 'Gutta', owner_user_id: alice.id, innsats: 200 })
    await seedLeagueMember({ league_id: liga.id, user_id: alice.id })
    return liga
}

test.beforeEach(async () => {
    await truncateAll()
})

test('nybruker som blir med via invitasjon vises i både hovedliga-tavla og den private ligaen', async ({ page }) => {
    const liga = await seedLigaMedEier()
    await seedUser({ firebase_user_id: 'newbie', name: 'newbie' })
    await loggInn(page, 'newbie')

    await test.step('Blir med i den private ligaen via invitasjonslenka', async () => {
        await page.goto(`/bli-med/${liga.invite_token}`)
        await page.getByRole('button', { name: 'Bli med i ligaen' }).click()
        await expect(page).toHaveURL(new RegExp(`/ligaer/${liga.id}$`))
    })

    await test.step('Er registrert som medlem av Gutta', async () => {
        expect(await erMedlem(liga.id, 'newbie')).toBe(true)
    })

    await test.step('Vises i både hovedliga-tavla og i Gutta', async () => {
        expect(await hovedligaNavn(page)).toContain('newbie')
        expect(await privatligaNavn(page, 'Gutta')).toContain('newbie')
    })
})
