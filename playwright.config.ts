import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { defineConfig, devices } from '@playwright/test'

// E2E-tester mot den lokale test-stacken (PGlite in-memory Postgres via
// socket-server + `next start` i test-auth-modus). Stacken startes i
// test/e2e/global-setup.ts.
const PORT = Number(process.env.TEST_PORT ?? 3100)

// Finn en kjørbar nettleser. Som regel lar vi Playwright bruke sitt eget
// nedlastede build (default, og det CI gjør via `playwright install`). Men i
// enkelte miljøer (f.eks. en sandkasse) kan ikke det pinnede buildet lastes ned,
// og en eldre Chromium er forhåndsinstallert under PLAYWRIGHT_BROWSERS_PATH. Da
// peker vi Playwright dit. Eksplisitt PW_EXECUTABLE_PATH vinner. Begge er inert i
// CI, der PLAYWRIGHT_BROWSERS_PATH er usatt og buildet alltid er på plass.
function finnNettleser(): string | undefined {
    if (process.env.PW_EXECUTABLE_PATH) return process.env.PW_EXECUTABLE_PATH
    const root = process.env.PLAYWRIGHT_BROWSERS_PATH
    if (!root || !existsSync(root)) return undefined
    const dir = readdirSync(root)
        .filter((d) => d.startsWith('chromium-'))
        .sort()
        .pop()
    if (!dir) return undefined
    const exe = join(root, dir, 'chrome-linux', 'chrome')
    return existsSync(exe) ? exe : undefined
}

const executablePath = finnNettleser()

export default defineConfig({
    testDir: './test/e2e',
    globalSetup: './test/e2e/global-setup.ts',
    timeout: 30000,
    fullyParallel: false,
    workers: 1,
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                ...(executablePath ? { launchOptions: { executablePath } } : {}),
            },
        },
    ],
})
