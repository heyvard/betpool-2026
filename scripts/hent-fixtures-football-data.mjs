// Laster ned alle kamper for et mesterskap fra football-data.org og skriver
// dem til src/data/footballDataFixtures.json (rå data beholdes). Kjøres lokalt;
// tokenet (FOOTBALL_DATA_TOKEN) hentes fra .env.local via @next/env.
//
// Kjør: pnpm hent-fixtures-fd
//   evt. overstyr: COMPETITION=WC SEASON=2026 pnpm hent-fixtures-fd
//   eller som argumenter: node scripts/hent-fixtures-football-data.mjs --competition WC --season 2026

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvConfig(projectRoot)

const BASE_URL = 'https://api.football-data.org/v4'
const OUT_FILE = resolve(projectRoot, 'src/data/footballDataFixtures.json')

function lesArg(navn, fallback) {
    const flagg = `--${navn}`
    const i = process.argv.indexOf(flagg)
    if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1]
    return process.env[navn.toUpperCase()] ?? fallback
}

const token = process.env.FOOTBALL_DATA_TOKEN
if (!token) {
    console.error('Mangler FOOTBALL_DATA_TOKEN. Legg tokenet i .env.local (FOOTBALL_DATA_TOKEN=...).')
    process.exit(1)
}

const competition = lesArg('competition', 'WC')
const season = lesArg('season', '2026')

async function hentKamper() {
    const url = new URL(`${BASE_URL}/competitions/${competition}/matches`)
    if (season) url.searchParams.set('season', season)

    const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
    if (!res.ok) {
        // football-data svarer { message, errorCode } ved feil (403 ugyldig token,
        // 429 rate limit, 400 ukjent season osv.).
        const body = await res.text()
        throw new Error(`football-data.org svarte ${res.status} ${res.statusText}: ${body}`)
    }
    return res.json()
}

async function main() {
    console.log(`Henter kamper for competition=${competition}, season=${season} …`)

    const body = await hentKamper()
    const antall = body.matches?.length ?? 0

    writeFileSync(OUT_FILE, JSON.stringify(body, null, 4) + '\n')

    console.log(`Skrev ${antall} kamper til ${OUT_FILE}`)
    if (antall === 0) {
        console.warn(
            'Tomt svar — sjekk at SEASON-året stemmer med den aktive WC-sesongen ' + '(prøv f.eks. en annen SEASON).',
        )
    }
}

main().catch((e) => {
    console.error(e.message ?? e)
    process.exit(1)
})
