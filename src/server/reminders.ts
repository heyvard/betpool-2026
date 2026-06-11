import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { PoolClient } from 'pg'

import { hentKamper } from '../data/matches'
import { Match } from '../types/types'
import { sendPushTilBruker } from './push'

dayjs.extend(utc)
dayjs.extend(timezone)

const OSLO = 'Europe/Oslo'

export interface PåminnelseResultat {
    kamperIMorgen: number
    brukereVarslet: number
}

export interface EttermiddagsVarselResultat {
    kamperIKveldOgNatt: number
    brukereVarslet: number
}

export interface KampInfo {
    match_num: number
    home_team: string
    away_team: string
    game_start: string
}

export interface DryRunBruker {
    id: string
    name: string
    email: string
    language: string
    antallUtippet: number
    utippedeKamper: KampInfo[]
}

export interface EttermiddagsVarselDryRunBruker {
    id: string
    name: string
    email: string
    language: string
    antallUtippet: number
    utippedeKamper: KampInfo[]
}

export interface PåminnelseDryRunResultat {
    kamperIMorgen: KampInfo[]
    brukereVilBliVarslet: DryRunBruker[]
}

export interface EttermiddagsVarselDryRunResultat {
    kamperIKveldOgNatt: KampInfo[]
    brukereVilBliVarslet: EttermiddagsVarselDryRunBruker[]
}

function kampTilInfo(m: Match): KampInfo {
    return { match_num: m.match_num, home_team: m.home_team, away_team: m.away_team, game_start: m.game_start }
}

function morgendagsTekster(language: string, antall: number): { title: string; body: string } {
    if (language === 'fr') {
        return {
            title: "N'oublie pas de parier ! ⚽️",
            body:
                antall === 1
                    ? "Tu as 1 match que tu n'as pas parié pour demain."
                    : `Tu as ${antall} matchs que tu n'as pas pariés pour demain.`,
        }
    }
    return {
        title: 'Husk å tippe! ⚽️',
        body:
            antall === 1
                ? 'Du har 1 kamp du ikke har tippet i morgen.'
                : `Du har ${antall} kamper du ikke har tippet i morgen.`,
    }
}

function ettermiddagsTekster(language: string, antall: number): { title: string; body: string } {
    if (language === 'fr') {
        return {
            title: "N'oublie pas de parier ! ⚽️",
            body:
                antall === 1
                    ? "Tu as 1 match que tu n'as pas parié ce soir."
                    : `Tu as ${antall} matchs que tu n'as pas pariés ce soir.`,
        }
    }
    return {
        title: 'Husk å tippe! ⚽️',
        body:
            antall === 1
                ? 'Du har 1 kamp du ikke har tippet i kveld og natt.'
                : `Du har ${antall} kamper du ikke har tippet i kveld og natt.`,
    }
}

async function hentMorgendagensKamper(client: PoolClient): Promise<Match[]> {
    // Kampdag-vindu kl. 12:00 i morgen → kl. 12:00 overimorgen Oslo-tid,
    // slik at natt-kamper (01:00–06:00 Oslo) inkluderes i riktig kampdag.
    const iMorgenKampDagStart = dayjs().tz(OSLO).add(1, 'day').startOf('day').add(12, 'hour')
    const iMorgenKampDagSlutt = iMorgenKampDagStart.add(1, 'day')

    console.log(`[send-reminders] kampdag-vindu: ${iMorgenKampDagStart.format()} → ${iMorgenKampDagSlutt.format()}`)

    return (await hentKamper(client)).filter((m) => {
        const kampstart = dayjs(m.game_start)
        return !kampstart.isBefore(iMorgenKampDagStart) && kampstart.isBefore(iMorgenKampDagSlutt)
    })
}

async function hentDagensGjenværendeKamper(client: PoolClient): Promise<Match[]> {
    // Kampdag-vindu: 12:00 i dag → 12:00 i morgen Oslo-tid, men kun kamper som ennå ikke har startet.
    const nå = dayjs()
    const dagensKampDagStart = nå.tz(OSLO).startOf('day').add(12, 'hour')
    const dagensKampDagSlutt = dagensKampDagStart.add(1, 'day')

    console.log(
        `[send-evening-reminders] kampdag-vindu: ${dagensKampDagStart.format()} → ${dagensKampDagSlutt.format()}`,
    )

    return (await hentKamper(client)).filter((m) => {
        const kampstart = dayjs(m.game_start)
        return (
            !kampstart.isBefore(dagensKampDagStart) && kampstart.isBefore(dagensKampDagSlutt) && kampstart.isAfter(nå)
        )
    })
}

// Sender én daglig digest til hver bruker som har kamper de ikke har tippet i morgen
// (norsk kalenderdøgn). Brukere uten push-abonnement hoppes naturlig over.
export async function sendPåminnelser(client: PoolClient): Promise<PåminnelseResultat> {
    console.log('[send-reminders] starter')

    const morgendagensKamper = await hentMorgendagensKamper(client)

    console.log(`[send-reminders] ${morgendagensKamper.length} kamper i morgendagens kampdag-vindu`)

    if (morgendagensKamper.length === 0) {
        console.log('[send-reminders] ingen kamper i morgen — avslutter')
        return { kamperIMorgen: 0, brukereVarslet: 0 }
    }

    const matchNums = morgendagensKamper.map((m) => m.match_num)

    const brukere = (
        await client.query<{ id: string; language: string }>(
            `SELECT id, language FROM users WHERE active = true AND notif_reminders = true`,
        )
    ).rows
    console.log(`[send-reminders] ${brukere.length} aktive brukere med påminnelser på`)

    const tippet = (
        await client.query<{ user_id: string; match_num: number }>(
            `SELECT user_id, match_num FROM bets WHERE match_num = ANY($1::int[])`,
            [matchNums],
        )
    ).rows
    const tippetPerBruker = new Map<string, Set<number>>()
    tippet.forEach((t) => {
        if (!tippetPerBruker.has(t.user_id)) {
            tippetPerBruker.set(t.user_id, new Set())
        }
        tippetPerBruker.get(t.user_id)!.add(t.match_num)
    })

    let brukereVarslet = 0
    for (const bruker of brukere) {
        const tippetSet = tippetPerBruker.get(bruker.id) ?? new Set<number>()
        const antallUtippet = matchNums.filter((n) => !tippetSet.has(n)).length
        if (antallUtippet === 0) {
            continue
        }
        const tekster = morgendagsTekster(bruker.language, antallUtippet)
        const sendt = await sendPushTilBruker(client, bruker.id, { ...tekster, url: '/my-bets' })
        if (sendt > 0) {
            brukereVarslet++
            console.log(
                `[send-reminders] varslet bruker ${bruker.id} (${bruker.language}) om ${antallUtippet} utippede kamper`,
            )
        }
    }

    const resultat = { kamperIMorgen: morgendagensKamper.length, brukereVarslet }
    console.log('[send-reminders] ferdig —', resultat)
    return resultat
}

// Dry run: viser hvilke kamper som ville blitt inkludert og hvem som ville fått påminnelse,
// uten å sende noe.
export async function dryRunPåminnelser(client: PoolClient): Promise<PåminnelseDryRunResultat> {
    console.log('[send-reminders] dry run starter')

    const morgendagensKamper = await hentMorgendagensKamper(client)

    console.log(`[send-reminders] dry run: ${morgendagensKamper.length} kamper i morgendagens kampdag-vindu`)

    if (morgendagensKamper.length === 0) {
        return { kamperIMorgen: [], brukereVilBliVarslet: [] }
    }

    const matchNums = morgendagensKamper.map((m) => m.match_num)

    const brukere = (
        await client.query<{ id: string; name: string; email: string; language: string }>(
            `SELECT DISTINCT u.id, u.name, u.email, u.language
             FROM users u
             INNER JOIN push_subscriptions ps ON ps.user_id = u.id
             WHERE u.active = true AND u.notif_reminders = true`,
        )
    ).rows
    console.log(`[send-reminders] dry run: ${brukere.length} aktive brukere med påminnelser på og push-abonnement`)

    const tippet = (
        await client.query<{ user_id: string; match_num: number }>(
            `SELECT user_id, match_num FROM bets WHERE match_num = ANY($1::int[])`,
            [matchNums],
        )
    ).rows
    const tippetPerBruker = new Map<string, Set<number>>()
    tippet.forEach((t) => {
        if (!tippetPerBruker.has(t.user_id)) {
            tippetPerBruker.set(t.user_id, new Set())
        }
        tippetPerBruker.get(t.user_id)!.add(t.match_num)
    })

    const brukereVilBliVarslet: DryRunBruker[] = []
    for (const bruker of brukere) {
        const tippetSet = tippetPerBruker.get(bruker.id) ?? new Set<number>()
        const utippedeKamper = morgendagensKamper.filter((m) => !tippetSet.has(m.match_num)).map(kampTilInfo)
        if (utippedeKamper.length === 0) {
            continue
        }
        brukereVilBliVarslet.push({
            id: bruker.id,
            name: bruker.name,
            email: bruker.email,
            language: bruker.language,
            antallUtippet: utippedeKamper.length,
            utippedeKamper,
        })
        console.log(
            `[send-reminders] dry run: bruker ${bruker.email} (${bruker.language}) ville fått varsel om ${utippedeKamper.length} kamper`,
        )
    }

    const resultat = { kamperIMorgen: morgendagensKamper.map(kampTilInfo), brukereVilBliVarslet }
    console.log(
        `[send-reminders] dry run ferdig — ${resultat.kamperIMorgen.length} kamper, ${resultat.brukereVilBliVarslet.length} ville blitt varslet`,
    )
    return resultat
}

// Ettermiddagsvarsel: sender til brukere med utippede kamper i kveld/natt.
// Brukere uten push-abonnement hoppes naturlig over.
export async function sendEttermiddagsVarsler(client: PoolClient): Promise<EttermiddagsVarselResultat> {
    console.log('[send-evening-reminders] starter')

    const kamper = await hentDagensGjenværendeKamper(client)

    console.log(`[send-evening-reminders] ${kamper.length} kamper i kveld/natt-vinduet`)

    if (kamper.length === 0) {
        console.log('[send-evening-reminders] ingen kamper i kveld/natt — avslutter')
        return { kamperIKveldOgNatt: 0, brukereVarslet: 0 }
    }

    const matchNums = kamper.map((m) => m.match_num)

    const brukere = (
        await client.query<{ id: string; language: string }>(
            `SELECT id, language FROM users WHERE active = true AND notif_reminders = true`,
        )
    ).rows
    console.log(`[send-evening-reminders] ${brukere.length} aktive brukere med påminnelser på`)

    const tippet = (
        await client.query<{ user_id: string; match_num: number }>(
            `SELECT user_id, match_num FROM bets WHERE match_num = ANY($1::int[])`,
            [matchNums],
        )
    ).rows
    const tippetPerBruker = new Map<string, Set<number>>()
    tippet.forEach((t) => {
        if (!tippetPerBruker.has(t.user_id)) {
            tippetPerBruker.set(t.user_id, new Set())
        }
        tippetPerBruker.get(t.user_id)!.add(t.match_num)
    })

    let brukereVarslet = 0
    for (const bruker of brukere) {
        const tippetSet = tippetPerBruker.get(bruker.id) ?? new Set<number>()
        const antallUtippet = matchNums.filter((n) => !tippetSet.has(n)).length
        if (antallUtippet === 0) {
            continue
        }
        const tekster = ettermiddagsTekster(bruker.language, antallUtippet)
        const sendt = await sendPushTilBruker(client, bruker.id, { ...tekster, url: '/my-bets' })
        if (sendt > 0) {
            brukereVarslet++
            console.log(
                `[send-evening-reminders] varslet bruker ${bruker.id} (${bruker.language}) om ${antallUtippet} utippede kamper`,
            )
        }
    }

    const resultat = { kamperIKveldOgNatt: kamper.length, brukereVarslet }
    console.log('[send-evening-reminders] ferdig —', resultat)
    return resultat
}

// Dry run for ettermiddagsvarsel.
export async function dryRunEttermiddagsVarsler(client: PoolClient): Promise<EttermiddagsVarselDryRunResultat> {
    console.log('[send-evening-reminders] dry run starter')

    const kamper = await hentDagensGjenværendeKamper(client)

    console.log(`[send-evening-reminders] dry run: ${kamper.length} kamper i kveld/natt-vinduet`)

    if (kamper.length === 0) {
        return { kamperIKveldOgNatt: [], brukereVilBliVarslet: [] }
    }

    const matchNums = kamper.map((m) => m.match_num)

    const brukere = (
        await client.query<{ id: string; name: string; email: string; language: string }>(
            `SELECT DISTINCT u.id, u.name, u.email, u.language
             FROM users u
             INNER JOIN push_subscriptions ps ON ps.user_id = u.id
             WHERE u.active = true AND u.notif_reminders = true`,
        )
    ).rows
    console.log(
        `[send-evening-reminders] dry run: ${brukere.length} aktive brukere med påminnelser på og push-abonnement`,
    )

    const tippet = (
        await client.query<{ user_id: string; match_num: number }>(
            `SELECT user_id, match_num FROM bets WHERE match_num = ANY($1::int[])`,
            [matchNums],
        )
    ).rows
    const tippetPerBruker = new Map<string, Set<number>>()
    tippet.forEach((t) => {
        if (!tippetPerBruker.has(t.user_id)) {
            tippetPerBruker.set(t.user_id, new Set())
        }
        tippetPerBruker.get(t.user_id)!.add(t.match_num)
    })

    const brukereVilBliVarslet: EttermiddagsVarselDryRunBruker[] = []
    for (const bruker of brukere) {
        const tippetSet = tippetPerBruker.get(bruker.id) ?? new Set<number>()
        const utippedeKamper = kamper.filter((m) => !tippetSet.has(m.match_num)).map(kampTilInfo)
        if (utippedeKamper.length === 0) {
            continue
        }
        brukereVilBliVarslet.push({
            id: bruker.id,
            name: bruker.name,
            email: bruker.email,
            language: bruker.language,
            antallUtippet: utippedeKamper.length,
            utippedeKamper,
        })
        console.log(
            `[send-evening-reminders] dry run: bruker ${bruker.email} (${bruker.language}) ville fått varsel om ${utippedeKamper.length} kamper`,
        )
    }

    const resultat = { kamperIKveldOgNatt: kamper.map(kampTilInfo), brukereVilBliVarslet }
    console.log(
        `[send-evening-reminders] dry run ferdig — ${resultat.kamperIKveldOgNatt.length} kamper, ${resultat.brukereVilBliVarslet.length} ville blitt varslet`,
    )
    return resultat
}
