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
    // Strukturert toppscorer-tipp (FK → players). Brukes til poeng og visning;
    // fritekst-feltet `topscorer` beholdes kun som historikk/kilde for /toppscorer-fiks.
    topscorer_player_id?: number | null
    topscorer_player_name?: string | null
    topscorer_forrige_player_name?: string | null
    winner_endret?: boolean
    topscorer_endret?: boolean
    winner_forrige?: string
    topscorer_forrige?: string
    paid: boolean
    winnerPoints?: number
    topscorerPoints?: number
}

export interface SluttspillResultat {
    avgjortPa: 'ekstraomganger' | 'straffer'
    vinner: 'home' | 'away'
    etter120: [number, number] // rt + et per lag (stillingen etter 120 min)
    straffer: [number, number] | null // kun ved straffesparkkonkurranse
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
    // Sluttspill-info (e.omg./straffer + hvem som gikk videre). Rent presentasjon
    // — ordinær tid er fortsatt det eneste som scores.
    sluttspill?: SluttspillResultat | null
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
    sluttspill?: SluttspillResultat | null
}

export interface AllBets {
    users: OtherUser[]
    bets: MatchBet[]
    tournamentResult?: { winnerTeam: string; topscorerPlayerIds: number[] }
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
    })
}
