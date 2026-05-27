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

// Sender én daglig digest til hver bruker som har kamper de ikke har tippet i morgen
// (norsk kalenderdøgn). Brukere uten push-abonnement hoppes naturlig over.
export async function sendPåminnelser(client: PoolClient): Promise<PåminnelseResultat> {
    // Kampdag-vindu kl. 12:00 i morgen → kl. 12:00 overimorgen Oslo-tid,
    // slik at natt-kamper (01:00–06:00 Oslo) inkluderes i riktig kampdag.
    const iMorgenKampDagStart = dayjs().tz(OSLO).add(1, 'day').startOf('day').add(12, 'hour')
    const iMorgenKampDagSlutt = iMorgenKampDagStart.add(1, 'day')

    const morgendagensKamper = getMatches().filter((m) => {
        const kampstart = dayjs(m.game_start)
        return !kampstart.isBefore(iMorgenKampDagStart) && kampstart.isBefore(iMorgenKampDagSlutt)
    })

    if (morgendagensKamper.length === 0) {
        return { kamperIMorgen: 0, brukereVarslet: 0 }
    }

    const matchNums = morgendagensKamper.map((m) => m.match_num)

    const brukere = (
        await client.query<{ id: string }>(`SELECT id FROM users WHERE active = true AND notif_reminders = true`)
    ).rows

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
        }
    }

    return { kamperIMorgen: morgendagensKamper.length, brukereVarslet }
}
