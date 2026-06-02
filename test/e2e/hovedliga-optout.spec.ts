import { test, expect, type Page } from '@playwright/test'

import { seedUser, seedLeague, seedLeagueMember, truncateAll, withDb } from '../support/db'

// Opt-ut fra hovedligaen: en bruker som er med i en privat liga kan velge bort
// hovedligaen. Da skal tipsene deres ikke telle i hovedligaen — de skal være
// usynlige i hovedliga-tavla, men fortsatt med i den private ligaens tavle.
// Valget kan endres senere under Mine ligaer, og tilbys ved oppmelding (signup).

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

async function loggInn(page: Page, bruker: string): Promise<void> {
    await page.context().addCookies([{ name: 'betpool_test_user', value: bruker, url: URL_BASE }])
}

// Navnene på radene i ledertavla (kolonne 3).
async function ledertavleNavn(page: Page): Promise<string[]> {
    await page.goto('/leaderboard')
    const rader = page.locator('tbody tr')
    await expect(rader.first()).toBeVisible()
    const ut: string[] = []
    for (let i = 0; i < (await rader.count()); i++) {
        ut.push((await rader.nth(i).locator('td').nth(2).innerText()).trim())
    }
    return ut
}

async function iHovedliga(firebaseUserId: string): Promise<boolean> {
    return withDb(async (c) => {
        const r = await c.query<{ i_hovedliga: boolean }>(`SELECT i_hovedliga FROM users WHERE firebase_user_id = $1`, [
            firebaseUserId,
        ])
        return r.rows[0].i_hovedliga
    })
}

test.beforeEach(async () => {
    await truncateAll()
})

test('opt-ut-bruker skjules fra hovedligaen, men vises i den private ligaen', async ({ page }) => {
    // alice + carol er med i hovedligaen, bob har valgt den bort. Alle tre er
    // medlemmer av den private ligaen «Gutta».
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })
    await seedUser({ firebase_user_id: 'carol', name: 'carol' })
    const bob = await seedUser({ firebase_user_id: 'bob', name: 'bob', i_hovedliga: false })

    const liga = await seedLeague({ name: 'Gutta', owner_user_id: alice.id })
    await seedLeagueMember({ league_id: liga.id, user_id: alice.id })
    await seedLeagueMember({ league_id: liga.id, user_id: bob.id })

    await loggInn(page, 'alice')

    await test.step('Hovedliga-tavla viser alice og carol, men ikke bob', async () => {
        const navn = await ledertavleNavn(page)
        expect(navn).toContain('alice')
        expect(navn).toContain('carol')
        expect(navn).not.toContain('bob')
    })

    await test.step('Den private ligaen viser både alice og bob', async () => {
        await page.goto('/leaderboard')
        await page.locator('#liga-velger').selectOption({ label: 'Gutta' })
        const rader = page.locator('tbody tr')
        await expect(rader.first()).toBeVisible()
        const navn: string[] = []
        for (let i = 0; i < (await rader.count()); i++) {
            navn.push((await rader.nth(i).locator('td').nth(2).innerText()).trim())
        }
        expect(navn).toContain('alice')
        expect(navn).toContain('bob')
        // carol er ikke medlem av Gutta, så hun vises ikke der.
        expect(navn).not.toContain('carol')
    })
})

test('bob kan slå seg på hovedligaen igjen under Mine ligaer', async ({ page }) => {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })
    const bob = await seedUser({ firebase_user_id: 'bob', name: 'bob', i_hovedliga: false })
    const liga = await seedLeague({ name: 'Gutta', owner_user_id: alice.id })
    await seedLeagueMember({ league_id: liga.id, user_id: alice.id })
    await seedLeagueMember({ league_id: liga.id, user_id: bob.id })

    await loggInn(page, 'bob')

    await test.step('Bryteren er av, og bob mangler i hovedliga-tavla', async () => {
        await page.goto('/ligaer')
        const bryter = page.getByRole('switch', { name: 'Med i hovedligaen' })
        await expect(bryter).toBeVisible()
        await expect(bryter).not.toBeChecked()

        // bob er opt-ut ⇒ ledertavla defaulter til den private ligaen. Velg
        // hovedligaen eksplisitt og bekreft at bob ikke er der.
        await page.goto('/leaderboard')
        await page.locator('#liga-velger').selectOption({ label: '🏆 Hovedligaen' })
        const rader = page.locator('tbody tr')
        await expect(rader.first()).toBeVisible()
        const navn: string[] = []
        for (let i = 0; i < (await rader.count()); i++) {
            navn.push((await rader.nth(i).locator('td').nth(2).innerText()).trim())
        }
        expect(navn).not.toContain('bob')
    })

    await test.step('Slår på bryteren', async () => {
        await page.goto('/ligaer')
        await page.getByRole('switch', { name: 'Med i hovedligaen' }).click()
        await expect(page.getByRole('switch', { name: 'Med i hovedligaen' })).toBeChecked()
        expect(await iHovedliga('bob')).toBe(true)
    })

    await test.step('Nå vises bob i hovedliga-tavla', async () => {
        expect(await ledertavleNavn(page)).toContain('bob')
    })
})

test('valgskjermen ved oppmelding lar en ny bruker velge bort hovedligaen', async ({ page }) => {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })
    await seedUser({ firebase_user_id: 'newbie', name: 'newbie' })
    const liga = await seedLeague({ name: 'Gutta', owner_user_id: alice.id, innsats: 200 })
    await seedLeagueMember({ league_id: liga.id, user_id: alice.id })

    await loggInn(page, 'newbie')

    // Kommer hit som om rett etter signup (nybruker=1) ⇒ hovedliga-valget vises.
    await page.goto(`/bli-med/${liga.invite_token}?nybruker=1`)

    const bryter = page.getByRole('switch', { name: 'Bli med i hovedligaen også?' })
    await expect(bryter).toBeVisible()
    await expect(bryter).toBeChecked()

    // Velg bort hovedligaen, og bli med i ligaen.
    await bryter.click()
    await page.getByRole('button', { name: 'Bli med i ligaen' }).click()

    await expect(page).toHaveURL(new RegExp(`/ligaer/${liga.id}$`))
    expect(await iHovedliga('newbie')).toBe(false)
})
