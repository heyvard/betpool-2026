import { useMemo } from 'react'

import { UseAllBets, AllBets } from './useAllBets'
import { UseMatches } from './useMatches'
import { UseUser } from './useUser'
import { calculateLeaderboard, LeaderBoard } from '../components/results/calculateAllScores'
import { calculateAllBetsExtended, filtrerAllBets } from '../components/results/calculateAllBetsExtended'
import { erKampFerdig } from '../data/matches'
import { avatarFarge, byggHistorikk, HistorikkDeltaker } from '../lib/byggHistorikk'

function visningsnavn(navn: string): string {
    return navn.includes('@') ? navn.split('@')[0] : navn
}

export interface MinPlassering {
    /** Plassering i hovedligaen på siste (nyeste) spilte kampdag. */
    plass: number
    /**
     * Endring siden forrige kampdag (positiv = opp, negativ = ned, 0 = uendret).
     * `null` når det bare finnes én kampdag så langt — ingen tidligere data å
     * sammenligne med.
     */
    diff: number | null
}

/**
 * Rekonstruerer innlogget brukers plassering i hovedligaen og endringen siden
 * forrige kampdag på klienten — samme kjede som historikk-siden bruker
 * (`byggHistorikk` → `calculateAllBetsExtended` → `calculateLeaderboard`),
 * ingen ny backend-tabell eller snapshots. Returnerer `null` til data er klare.
 */
export function useMinPlassering(): MinPlassering | null {
    const { data } = UseAllBets()
    const { data: matches } = UseMatches()
    const { data: me } = UseUser()

    return useMemo(() => {
        if (!data || !matches || !me) return null

        const raw = data.raw
        const hovedligaIds = new Set(raw.users.filter((u) => u.i_hovedliga !== false).map((u) => u.id))
        const deltakere: HistorikkDeltaker[] = raw.users
            .filter((u) => u.i_hovedliga !== false)
            .map((u) => ({ userid: u.id, navn: u.name }))
        const populasjonsBets = filtrerAllBets(raw, hovedligaIds)

        const beregnTavle = (bets: AllBets): LeaderBoard[] => {
            const ext = calculateAllBetsExtended(bets)
            return calculateLeaderboard(ext.bets, ext.users)
        }

        const h = byggHistorikk(populasjonsBets, matches, deltakere, beregnTavle, {
            harResultat: (k) => erKampFerdig(k.status),
            kickoff: (k) => new Date(k.game_start).getTime(),
            poengAv: (r) => r.poeng - (r.livePoeng ?? 0),
            visningsnavn,
            farge: avatarFarge,
        })

        const serie = h.serier.find((s) => s.userid === me.id)
        if (!serie || serie.ranks.length === 0) return null

        const plassNaa = serie.ranks[serie.ranks.length - 1]
        const plassForrige = serie.ranks[serie.ranks.length - 2]
        const diff = plassForrige === undefined ? null : plassForrige - plassNaa

        return { plass: plassNaa, diff }
    }, [data, matches, me])
}
