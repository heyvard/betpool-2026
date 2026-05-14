import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'

// Delt oppstart av test-stacken: en Postgres-container + en lokal Next-server
// kjørt i test-auth-modus. Brukes av både jest-integrasjonstestene og Playwright.
//
// Vi bygger appen (`next build`) og kjører `next start` — IKKE `next dev`.
// `next dev` (Turbopack) spawner en stor, dårlig ryddet kompilator-worker-farm
// under testlasten og spiser opp alt minnet på maskinen. `next start` er én
// enkelt produksjonsprosess: ingen filovervåkning, ingen kompilator, ingen workers.
//
// Konsekvens: `NEXT_PUBLIC_TEST_AUTH` er en `NEXT_PUBLIC_*`-variabel og bakes inn
// ved BUILD-tid — den må derfor settes både for `next build` og `next start`.

export interface TestStack {
    container: StartedPostgreSqlContainer
    proc: ChildProcess
    baseUrl: string
    dbUrl: string
}

const PORT = Number(process.env.TEST_PORT ?? 3100)

export async function startTestStack(): Promise<TestStack> {
    console.log('[test-stack] starter Postgres-container …')
    const container = await new PostgreSqlContainer('postgres:16').withStartupTimeout(120000).start()
    const dbUrl = container.getConnectionUri()

    // Felles env for build + start: test-auth på, mock av, peker på containeren.
    // Firebase initialiseres under `next build` («collecting page data») og kaster
    // `auth/invalid-api-key` hvis nøklene mangler. I test-auth-modus rører klienten
    // aldri Firebase, så dummy-verdier er trygge — de gjør bare at bygget går igjennom.
    const stackEnv = {
        ...process.env,
        POSTGRES_URL_NON_POOLING: dbUrl,
        NEXT_PUBLIC_TEST_AUTH: 'true',
        NEXT_PUBLIC_MOCK: 'false',
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'test-fake-api-key',
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'test.firebaseapp.com',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'test-project',
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'test.appspot.com',
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '0000000000',
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '1:0000000000:web:test',
    }

    // Kjør knex-migrasjonene mot containeren (knexfile leser POSTGRES_URL_NON_POOLING).
    // Kjør knex-binæren direkte — `pnpm knex` ville trigget en nøstet `pnpm install`-sjekk.
    console.log('[test-stack] kjører migrasjoner …')
    const knexBin = path.join(process.cwd(), 'node_modules', '.bin', 'knex')
    execSync(`${knexBin} migrate:latest`, { env: stackEnv, stdio: 'inherit' })

    // Bygg appen før start. `NEXT_PUBLIC_TEST_AUTH` bakes inn her.
    const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next')
    console.log('[test-stack] bygger appen (next build) …')
    execSync(`${nextBin} build`, { env: stackEnv, stdio: 'inherit' })

    const baseUrl = `http://localhost:${PORT}`
    console.log(`[test-stack] starter «next start» på ${baseUrl} …`)
    const proc = spawn(nextBin, ['start', '-p', String(PORT)], {
        env: stackEnv,
        stdio: 'inherit',
        detached: true,
    })

    await waitForServer(baseUrl)
    // Varm opp en API-rute før testene begynner.
    await fetch(`${baseUrl}/api/v1/test-users`).catch(() => undefined)
    console.log('[test-stack] klar')

    return { container, proc, baseUrl, dbUrl }
}

export async function stopTestStack(stack: TestStack): Promise<void> {
    if (stack.proc.pid) {
        const exited = new Promise<void>((resolve) => stack.proc.once('exit', () => resolve()))
        try {
            // Drep hele prosessgruppa (next-serveren kan spawne barn).
            process.kill(-stack.proc.pid, 'SIGTERM')
        } catch {
            // prosessen er allerede borte
        }
        // Vent på at next-serveren faktisk avslutter og lukker DB-tilkoblingene
        // sine før containeren stoppes — ellers logger pg en uncaughtException.
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))])
    }
    await stack.container.stop()
}

async function waitForServer(baseUrl: string, timeoutMs = 120000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(baseUrl)
            if (res.status < 500) return
        } catch {
            // serveren er ikke oppe ennå
        }
        await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error(`Next-serveren ble ikke klar innen ${timeoutMs}ms`)
}
