import { useQuery } from '@tanstack/react-query'

import { useAuthedFetch } from '../auth/authedFetch'
import { MatchPoeng } from '../components/results/matchScoreCalculator'
import { calculateAllBetsExtended } from '../components/results/calculateAllBetsExtended'

export interface OtherUser {
    id: string
    name: string
    picture: string | null
    winner?: string
    topscorer?: string
    paid: boolean
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
            return calculateAllBetsExtended(allBets)
        },
    })
}
