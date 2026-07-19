import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'

import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import knex from 'knex'

// Delt oppstart av test-stacken: en in-memory Postgres (PGlite) eksponert over en
// TCP-socket + en lokal Next-server kjørt i test-auth-modus. Brukes av både
// jest-integrasjonstestene og Playwright.
//
// PGlite er ekte Postgres kompilert til WASM. Vi kjører den i denne prosessen og
// legger en socket-server foran (`@electric-sql/pglite-socket`), slik at de tre
// prosessene som trenger DB-en — `next start`-serveren, jest-workerne og Playwright —
// alle kan koble til over en vanlig connection-string. `maxConnections` skrur på
// multiplexeren (PGlite v0.4+) som lar flere klienter dele den ene PGlite-instansen.
// Ingen Docker.
//
// Vi bygger appen (`next build`) og kjører `next start` — IKKE `next dev`.
// `next dev` (Turbopack) spawner en stor, dårlig ryddet kompilator-worker-farm
// under testlasten og spiser opp alt minnet på maskinen. `next start` er én
// enkelt produksjonsprosess: ingen filovervåkning, ingen kompilator, ingen workers.
//
// Konsekvens: `NEXT_PUBLIC_TEST_AUTH` er en `NEXT_PUBLIC_*`-variabel og bakes inn
// ved BUILD-tid — den må derfor settes både for `next build` og `next start`.

export interface TestStack {
    db: PGlite
    socketServer: PGLiteSocketServer
    proc: ChildProcess
    baseUrl: string
    dbUrl: string
}

const PORT = Number(process.env.TEST_PORT ?? 3100)
const DB_PORT = Number(process.env.TEST_DB_PORT ?? 5544)

export async function startTestStack(): Promise<TestStack> {
    console.log('[test-stack] starter PGlite (in-memory Postgres) …')
    const db = await PGlite.create()
    const socketServer = new PGLiteSocketServer({
        db,
        port: DB_PORT,
        host: '127.0.0.1',
        // Multiplexer flere samtidige tilkoblinger over den ene PGlite-instansen.
        maxConnections: 10,
    })
    await socketServer.start()
    // Migrering og seeding går over TCP mot denne stringen — aldri `db.query()`
    // direkte, siden socket-serveren holder en eksklusiv lås på instansen.
    const dbUrl = `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`

    // Felles env for build + start: test-auth på, mock av, peker på PGlite-socketen.
    // Firebase initialiseres under `next build` («collecting page data») og kaster
    // `auth/invalid-api-key` hvis nøklene mangler. I test-auth-modus rører klienten
    // aldri Firebase, så dummy-verdier er trygge — de gjør bare at bygget går igjennom.
    const stackEnv = {
        ...process.env,
        POSTGRES_URL_NON_POOLING: dbUrl,
        NEXT_PUBLIC_TEST_AUTH: 'true',
        NEXT_PUBLIC_MOCK: 'false',
        // Mocker Anthropic-kallet i AI-morgenrapporten/pallen (server/feed/podiumAi.ts,
        // morgenrapportAi.ts) med deterministisk innhold — ingen API-nøkkel eller
        // nettverkstilgang nødvendig i testene.
        ANTHROPIC_MOCK: process.env.ANTHROPIC_MOCK ?? 'true',
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'test-fake-api-key',
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'test.firebaseapp.com',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'test-project',
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'test.appspot.com',
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '0000000000',
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '1:0000000000:web:test',
        CRON_SECRET: process.env.CRON_SECRET ?? 'test-cron-secret',
        // Test-VAPID-nøkler slik at push-endepunkter kan kjøres i integrasjonstester.
        // Produksjonsnøkler overstyrer hvis de er satt.
        NEXT_PUBLIC_VAPID_PUBLIC_KEY:
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
            'BL6heX9yGXwOe1I8HnihlQXt4VQmeyPUZ4nVGyXbXT0m4wcaEPB_0jRLsRXVKTP43b7SvWbmRSfLsX65O6j94Mo',
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? '-Y78Bu_1GE8B1j34oFL_69gAPdPPZq5kHLGd9gIcxmc',
        // Tillat selvsignerte sertifikater i integrasjonstester (push-mock bruker HTTPS med egensignert cert).
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
    }

    // Kjør knex-migrasjonene mot PGlite — IN-PROCESS, ikke via knex-CLI.
    // PGlite + socket-serveren bor i denne prosessen, så en blokkerende `execSync`
    // ville fryst event-loopen og hindret socket-serveren i å svare på CLI-ens
    // tilkobling (deadlock). Programmatisk knex går over TCP mot socket-serveren
    // mens event-loopen lever.
    console.log('[test-stack] kjører migrasjoner …')
    const migrator = knex({
        client: 'pg',
        connection: dbUrl,
        migrations: { directory: path.join(process.cwd(), 'migrations') },
    })
    try {
        await migrator.migrate.latest()
    } finally {
        await migrator.destroy()
    }

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

    return { db, socketServer, proc, baseUrl, dbUrl }
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
        // sine før vi stenger PGlite — ellers logger pg en uncaughtException.
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))])
    }
    await stack.socketServer.stop()
    await stack.db.close()
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
