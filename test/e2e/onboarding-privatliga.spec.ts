import { test, expect, type Page } from '@playwright/test'

import { seedUser, seedLeague, seedLeagueMember, truncateAll, withDb } from '../support/db'

// Onboarding i en privat liga: en nybruker følger en invitasjonslenke rett etter
// signup (`?nybruker=1`). Da — og bare da — tilbys hovedliga-valget i selve flyten:
// «Bli med i hovedligaen også?». Brukeren svarer ja eller nei, og blir uansett
// med i den private ligaen. Testene dekker begge svarene ende-til-ende:
//   • spørsmålet vises (og bare i signup-flyten),
//   • valget lagres riktig i DB (`users.i_hovedliga`),
//   • brukeren blir medlem av den private ligaen,
//   • synligheten i ledertavla stemmer med valget.

const PORT = Number(process.env.TEST_PORT ?? 3100)
const URL_BASE = `http://localhost:${PORT}`

async function loggInn(page: Page, bruker: string): Promise<void> {
    await page.context().addCookies([{ name: 'betpool_test_user', value: bruker, url: URL_BASE }])
}

// Navnene på radene i ledertavla, lest fra navne-lenka i kolonne 3. Vi leser
// lenketeksten (ikke hele cella) så «Ikke betalt»-merket ikke blander seg inn.
async function synligeNavn(page: Page): Promise<string[]> {
    const rader = page.locator('tbody tr')
    await expect(rader.first()).toBeVisible()
    const ut: string[] = []
    for (let i = 0; i < (await rader.count()); i++) {
        ut.push((await rader.nth(i).locator('td').nth(2).locator('a').innerText()).trim())
    }
    return ut
}

async function hovedligaNavn(page: Page): Promise<string[]> {
    await page.goto('/leaderboard')
    return synligeNavn(page)
}

async function privatligaNavn(page: Page, ligaNavn: string): Promise<string[]> {
    await page.goto('/leaderboard')
    await page.locator('#liga-velger').selectOption({ label: ligaNavn })
    return synligeNavn(page)
}

async function iHovedliga(firebaseUserId: string): Promise<boolean> {
    return withDb(async (c) => {
        const r = await c.query<{ i_hovedliga: boolean }>(`SELECT i_hovedliga FROM users WHERE firebase_user_id = $1`, [
            firebaseUserId,
        ])
        return r.rows[0].i_hovedliga
    })
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

// Felles oppsett: en eier (alice) med en privat liga «Gutta». Eieren er med i
// både hovedligaen og den private ligaen. Returnerer ligaen så testene kan melde
// nybrukeren inn via invitasjonslenka.
async function seedLigaMedEier() {
    const alice = await seedUser({ firebase_user_id: 'alice', name: 'alice' })
    const liga = await seedLeague({ name: 'Gutta', owner_user_id: alice.id, innsats: 200 })
    await seedLeagueMember({ league_id: liga.id, user_id: alice.id })
    return liga
}

test.beforeEach(async () => {
    await truncateAll()
})

test('hovedliga-valget tilbys bare i signup-flyten, ikke ved et vanlig invitasjonsbesøk', async ({ page }) => {
    const liga = await seedLigaMedEier()
    await seedUser({ firebase_user_id: 'newbie', name: 'newbie' })
    await loggInn(page, 'newbie')

    const sporsmal = page.getByRole('switch', { name: 'Bli med i hovedligaen også?' })

    await test.step('Uten ?nybruker=1 vises ingen hovedliga-spørsmål', async () => {
        await page.goto(`/bli-med/${liga.invite_token}`)
        await expect(page.getByRole('button', { name: 'Bli med i ligaen' })).toBeVisible()
        await expect(sporsmal).toHaveCount(0)
    })

    await test.step('Med ?nybruker=1 dukker hovedliga-spørsmålet opp, påslått som standard', async () => {
        await page.goto(`/bli-med/${liga.invite_token}?nybruker=1`)
        await expect(page.getByText('Hovedligaen', { exact: true })).toBeVisible()
        await expect(sporsmal).toBeVisible()
        await expect(sporsmal).toBeChecked()
        await expect(page.getByText(/Hovedligaen er den store potten/)).toBeVisible()
    })
})

test('nybruker svarer JA — blir med i både den private ligaen og hovedligaen', async ({ page }) => {
    const liga = await seedLigaMedEier()
    await seedUser({ firebase_user_id: 'newbie', name: 'newbie' })
    await loggInn(page, 'newbie')

    await test.step('Åpner invitasjonen i signup-flyten og lar valget stå på', async () => {
        await page.goto(`/bli-med/${liga.invite_token}?nybruker=1`)
        const sporsmal = page.getByRole('switch', { name: 'Bli med i hovedligaen også?' })
        await expect(sporsmal).toBeChecked()
        // Lar bryteren stå på = svarer ja, og melder seg inn.
        await page.getByRole('button', { name: 'Bli med i ligaen' }).click()
        await expect(page).toHaveURL(new RegExp(`/ligaer/${liga.id}$`))
    })

    await test.step('Valget er lagret: medlem av Gutta og med i hovedligaen', async () => {
        expect(await erMedlem(liga.id, 'newbie')).toBe(true)
        expect(await iHovedliga('newbie')).toBe(true)
    })

    await test.step('Nybrukeren vises både i hovedliga-tavla og i Gutta', async () => {
        expect(await hovedligaNavn(page)).toContain('newbie')
        expect(await privatligaNavn(page, 'Gutta')).toContain('newbie')
    })
})

test('nybruker svarer NEI — blir med i den private ligaen, men ikke hovedligaen', async ({ page }) => {
    const liga = await seedLigaMedEier()
    await seedUser({ firebase_user_id: 'newbie', name: 'newbie' })
    await loggInn(page, 'newbie')

    await test.step('Åpner invitasjonen i signup-flyten og slår av hovedliga-valget', async () => {
        await page.goto(`/bli-med/${liga.invite_token}?nybruker=1`)
        const sporsmal = page.getByRole('switch', { name: 'Bli med i hovedligaen også?' })
        await expect(sporsmal).toBeChecked()
        // Slår av bryteren = svarer nei, og melder seg inn.
        await sporsmal.click()
        await expect(sporsmal).not.toBeChecked()
        await page.getByRole('button', { name: 'Bli med i ligaen' }).click()
        await expect(page).toHaveURL(new RegExp(`/ligaer/${liga.id}$`))
    })

    await test.step('Valget er lagret: medlem av Gutta, men ute av hovedligaen', async () => {
        expect(await erMedlem(liga.id, 'newbie')).toBe(true)
        expect(await iHovedliga('newbie')).toBe(false)
    })

    await test.step('Nybrukeren skjules fra hovedliga-tavla, men vises i Gutta', async () => {
        expect(await hovedligaNavn(page)).not.toContain('newbie')
        expect(await privatligaNavn(page, 'Gutta')).toContain('newbie')
    })
})
