import { defineConfig, devices } from '@playwright/test'

// E2E-tester mot den lokale test-stacken (PGlite in-memory Postgres via
// socket-server + `next start` i test-auth-modus). Stacken startes i
// test/e2e/global-setup.ts.
const PORT = Number(process.env.TEST_PORT ?? 3100)

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
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
