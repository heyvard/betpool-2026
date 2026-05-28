// Laster ned alle fixtures for et mesterskap fra API-Football og skriver dem
// til src/data/apiFootballFixtures.json (rå data beholdes). Kjøres lokalt; nøkkelen
// (API_FOOTBALL) hentes fra .env.local via @next/env.
//
// Kjør: pnpm hent-fixtures
//   evt. overstyr: LEAGUE=1 SEASON=2026 pnpm hent-fixtures
//   eller som argumenter: node scripts/hent-fixtures.mjs --league 1 --season 2026

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvConfig(projectRoot)

const BASE_URL = 'https://v3.football.api-sports.io'
const OUT_FILE = resolve(projectRoot, 'src/data/apiFootballFixtures.json')

function lesArg(navn, fallback) {
    const flagg = `--${navn}`
    const i = process.argv.indexOf(flagg)
    if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1]
    return process.env[navn.toUpperCase()] ?? fallback
}

const apiKey = process.env.API_FOOTBALL
if (!apiKey) {
    console.error('Mangler API_FOOTBALL. Legg nøkkelen i .env.local (API_FOOTBALL=...).')
    process.exit(1)
}

const league = lesArg('league', '1')
const season = lesArg('season', '2026')

async function hentSide(page) {
    const url = new URL(`${BASE_URL}/fixtures`)
    url.searchParams.set('league', league)
    url.searchParams.set('season', season)
    if (page > 1) url.searchParams.set('page', String(page))

    const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } })
    if (!res.ok) {
        throw new Error(`API-Football svarte ${res.status} ${res.statusText}`)
    }
    const body = await res.json()

    // API-Football svarer 200 selv ved feil — feilene ligger i errors-feltet
    // (kan være et objekt {key: msg} eller en tom array).
    const errors = body.errors
    const harFeil = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0
    if (harFeil) {
        throw new Error(`API-Football feil: ${JSON.stringify(errors)}`)
    }
    return body
}

async function main() {
    console.log(`Henter fixtures for league=${league}, season=${season} …`)

    const første = await hentSide(1)
    const alle = [...(første.response ?? [])]
    const totalSider = første.paging?.total ?? 1

    for (let page = 2; page <= totalSider; page++) {
        const side = await hentSide(page)
        alle.push(...(side.response ?? []))
    }

    const ut = {
        get: første.get,
        parameters: første.parameters,
        results: alle.length,
        response: alle,
    }

    writeFileSync(OUT_FILE, JSON.stringify(ut, null, 4) + '\n')

    console.log(`Skrev ${alle.length} fixtures til ${OUT_FILE}`)
    if (alle.length === 0) {
        console.warn(
            'Tomt svar — sjekk at season-verdien stemmer for dette mesterskapet ' + '(prøv f.eks. en annen SEASON).',
        )
    }
}

main().catch((e) => {
    console.error(e.message ?? e)
    process.exit(1)
})
