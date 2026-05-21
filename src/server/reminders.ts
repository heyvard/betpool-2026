import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { PoolClient } from 'pg'

import { getMatches } from '../data/matches'
import { sendPushTilBruker } from './push'

dayjs.extend(utc)
dayjs.extend(timezone)

const OSLO = 'Europe/Oslo'

export interface PåminnelseResultat {
    kamperIMorgen: number
    brukereVarslet: number
}

// Sender én daglig digest til hver bruker som har utipsa kamper i morgen
// (norsk kalenderdøgn). Brukere uten push-abonnement hoppes naturlig over.
export async function sendPåminnelser(client: PoolClient): Promise<PåminnelseResultat> {
    const iMorgen = dayjs().tz(OSLO).add(1, 'day')
    const start = iMorgen.startOf('day')
    const slutt = iMorgen.endOf('day')

    const morgendagensKamper = getMatches().filter((m) => {
        const kampstart = dayjs(m.game_start)
        return kampstart.isAfter(start) && kampstart.isBefore(slutt)
    })

    if (morgendagensKamper.length === 0) {
        return { kamperIMorgen: 0, brukereVarslet: 0 }
    }

    const matchNums = morgendagensKamper.map((m) => m.match_num)

    const brukere = (await client.query<{ id: string }>(`SELECT id FROM users WHERE active = true`)).rows

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
        const utipsa = matchNums.filter((n) => !tippetSet.has(n)).length
        if (utipsa === 0) {
            continue
        }
        const sendt = await sendPushTilBruker(client, bruker.id, {
            title: 'Husk å tippe! ⚽️',
            body: utipsa === 1 ? 'Du har 1 utipsa kamp i morgen.' : `Du har ${utipsa} utipsa kamper i morgen.`,
            url: '/my-bets',
        })
        if (sendt > 0) {
            brukereVarslet++
        }
    }

    return { kamperIMorgen: morgendagensKamper.length, brukereVarslet }
}
