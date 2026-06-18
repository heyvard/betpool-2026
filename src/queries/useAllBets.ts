import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { LIVE_SYNC_INTERVAL_SEKUNDER } from '../utils/liveSync'
import { MatchPoeng } from '../components/results/matchScoreCalculator'
import { calculateAllBetsExtended } from '../components/results/calculateAllBetsExtended'

export interface OtherUser {
    id: string
    name: string
    picture: string | null
    winner?: string
    topscorer?: string
    winner_endret?: boolean
    topscorer_endret?: boolean
    winner_forrige?: string
    topscorer_forrige?: string
    paid: boolean
    i_hovedliga?: boolean
    winnerPoints?: number
    topscorerPoints?: number
}

export interface MatchBet {
    user_id: string
    match_num: number
    game_start: string
    away_score: string | null
    away_team: string
    home_score: string | null
    away_result: string | null
    home_result: string | null
    home_team: string
    round: number
    joker?: boolean
    // Settes av /api/v1/bets: kampen pågår fortsatt og resultatet er et live
    // synket delresultat — poengene er dermed foreløpige.
    foreløpig?: boolean
}

export interface MatchBetMedScore {
    user_id: string
    match_num: number
    game_start: string
    away_score: number | null
    home_score: number | null
    away_team: string
    away_result: string
    home_result: string
    home_team: string
    round: number
    poeng: number
    riktigUtfall: boolean
    riktigResultat: boolean
    joker: boolean
    matchpoeng: MatchPoeng
    foreløpig?: boolean
}

export interface AllBets {
    users: OtherUser[]
    bets: MatchBet[]
}

export function UseAllBets() {
    const authedFetch = useAuthedFetch()

    return useQuery({
        queryKey: ['all-bets'],

        queryFn: async () => {
            const response = await authedFetch('/api/v1/bets', { method: 'GET' })
            const allBets = (await response.json()) as AllBets
            allBets.bets.forEach((bet) => {
                if (bet.home_result === null) {
                    bet.home_result = '0'
                }
                if (bet.away_result === null) {
                    bet.away_result = '0'
                }
            })
            // Behold rådataene ved siden av den globale beregningen, slik at
            // ledertavla kan beregne poeng populasjonsspesifikt (hovedliga vs.
            // privat liga) uten et nytt API-kall.
            return { ...calculateAllBetsExtended(allBets), raw: allBets }
        },

        // Poll så live-scoren oppdateres mens en kamp pågår. Kun da finnes det
        // foreløpige bets, så ellers faller vi tilbake til 60s — nok til å fange
        // at en kamp starter, men sparer Neon-compute og football-data-kall i de
        // lange idle-periodene. refetchIntervalInBackground = false → polling
        // pauses når fanen er skjult.
        refetchInterval: (query) => {
            const harLive = query.state.data?.raw?.bets?.some((b) => b.foreløpig)
            return harLive ? LIVE_SYNC_INTERVAL_SEKUNDER * 1000 : 60_000
        },
        refetchIntervalInBackground: false,
    })
}
