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
    antallUtippet: number
    utippedeKamper: KampInfo[]
}

export interface PåminnelseDryRunResultat {
    kamperIMorgen: KampInfo[]
    brukereVilBliVarslet: DryRunBruker[]
}

function kampTilInfo(m: Match): KampInfo {
    return { match_num: m.match_num, home_team: m.home_team, away_team: m.away_team, game_start: m.game_start }
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
        await client.query<{ id: string }>(`SELECT id FROM users WHERE active = true AND notif_reminders = true`)
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
        const sendt = await sendPushTilBruker(client, bruker.id, {
            title: 'Husk å tippe! ⚽️',
            body:
                antallUtippet === 1
                    ? 'Du har 1 kamp du ikke har tippet i morgen.'
                    : `Du har ${antallUtippet} kamper du ikke har tippet i morgen.`,
            url: '/my-bets',
        })
        if (sendt > 0) {
            brukereVarslet++
            console.log(`[send-reminders] varslet bruker ${bruker.id} om ${antallUtippet} utippede kamper`)
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
        await client.query<{ id: string; name: string; email: string }>(
            `SELECT id, name, email FROM users WHERE active = true AND notif_reminders = true`,
        )
    ).rows
    console.log(`[send-reminders] dry run: ${brukere.length} aktive brukere med påminnelser på`)

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
            antallUtippet: utippedeKamper.length,
            utippedeKamper,
        })
        console.log(
            `[send-reminders] dry run: bruker ${bruker.email} ville fått varsel om ${utippedeKamper.length} kamper`,
        )
    }

    const resultat = { kamperIMorgen: morgendagensKamper.map(kampTilInfo), brukereVilBliVarslet }
    console.log(
        `[send-reminders] dry run ferdig — ${resultat.kamperIMorgen.length} kamper, ${resultat.brukereVilBliVarslet.length} ville blitt varslet`,
    )
    return resultat
}
