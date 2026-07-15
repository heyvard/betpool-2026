import { finnUtfall, regnUtScoreForKamp } from './matchScoreCalculator'
import { stringTilNumber } from '../../utils/stringnumber'
import { AllBets, MatchBetMedScore, OtherUser } from '../../queries/useAllBets'
import { erNorgeKamp } from '../../data/matches'

export interface AllBetsExtended {
    users: OtherUser[]
    bets: MatchBetMedScore[]
}

/**
 * Snevrer inn et `AllBets`-sett til en gitt populasjon (sett av user-id-er).
 * Både brukere og bets filtreres, slik at en påfølgende `calculateAllBetsExtended`
 * regner raritet/bonuspott kun ut fra denne populasjonen. Brukes til å skille
 * hovedligaens poengberegning fra private ligaers.
 */
export function filtrerAllBets(allBets: AllBets, userIds: Set<string>): AllBets {
    return {
        users: allBets.users.filter((u) => userIds.has(u.id)),
        bets: allBets.bets.filter((b) => userIds.has(b.user_id)),
        tournamentResult: allBets.tournamentResult,
    }
}

/**
 * Bonuspoeng for winner-/topscorer-tips, basert på en trapp over andelen av poolen
 * som traff. Erstatter den gamle `min(ceil(users·3/ok), 15)`-formelen: «alene» heves
 * og premien faller brattere når flere treffer. Tersklene er andel-baserte og
 * skalerer dermed med pool-størrelsen.
 */
export function regnUtBonuspoeng(antallOk: number, antallUsers: number): number {
    if (antallOk === 0 || antallUsers === 0) {
        return 0
    }
    if (antallOk === 1) {
        return 25
    }
    const andel = antallOk / antallUsers
    if (andel < 0.05) return 18
    if (andel < 0.1) return 12
    if (andel < 0.2) return 8
    if (andel < 0.35) return 5
    return 3
}

export function calculateAllBetsExtended(allBets: AllBets): AllBetsExtended {
    const winner = allBets.tournamentResult?.winnerTeam ?? ''
    const topscorerPlayerIds = allBets.tournamentResult?.topscorerPlayerIds ?? []
    let scoreForKamp = regnUtScoreForKamp(allBets.bets)
    const betsMedScore = allBets.bets.map((b): MatchBetMedScore => {
        const norgeKamp = erNorgeKamp(b.home_team, b.away_team)
        // Joker er ikke tillatt på Norge-kamper — en evt. gammel joker der teller ikke.
        const joker = (b.joker ?? false) && !norgeKamp
        if (b.home_score == null || b.away_score == null) {
            return {
                ...b,
                away_score: stringTilNumber(b.away_score),
                home_score: stringTilNumber(b.home_score),
                home_result: b.home_result ?? '',
                away_result: b.away_result ?? '',
                poeng: 0,
                riktigResultat: false,
                riktigUtfall: false,
                joker: joker,
                matchpoeng: scoreForKamp.get(String(b.match_num))!,
            }
        } else {
            const utfall = finnUtfall(b.home_score, b.away_score)
            const riktigResultat = b.home_result == b.home_score && b.away_result == b.away_score
            let poeng = 0
            let riktigUtfall = utfall == scoreForKamp.get(String(b.match_num))!.utfall
            if (riktigUtfall) {
                poeng = poeng + scoreForKamp.get(String(b.match_num))!.riktigUtfall
            }
            if (riktigResultat) {
                poeng = poeng + scoreForKamp.get(String(b.match_num))!.riktigResultat
            }
            if (joker) {
                poeng = poeng * 2
            }
            // Norge-kamper teller dobbelt for alle.
            if (norgeKamp) {
                poeng = poeng * 2
            }
            return {
                ...b,
                away_score: stringTilNumber(b.away_score),
                home_score: stringTilNumber(b.home_score),
                home_result: b.home_result ?? '',
                away_result: b.away_result ?? '',
                poeng: poeng,
                riktigResultat: riktigResultat,
                riktigUtfall: riktigUtfall,
                joker: joker,
                matchpoeng: scoreForKamp.get(String(b.match_num))!,
            }
        }
    })
    // Vinner-treff: brukerens winner må matche turneringens winner. Fasiten er tom
    // («») til VM er avgjort — da skal ingen få poeng. Uten denne vakten ville alle
    // ukoblede brukere (u.winner == «» eller null == «») matchet den tomme fasiten.
    function riktigWinner(userWinner: string | null | undefined) {
        return winner !== '' && userWinner === winner
    }
    const winnerPointsFun = () => {
        const antallOk = allBets.users.filter((u) => riktigWinner(u.winner)).length
        return regnUtBonuspoeng(antallOk, allBets.users.length)
    }
    const poengPerVinner = winnerPointsFun()
    // Strukturert toppscorer-treff: brukerens topscorer_player_id må peke på en av
    // turneringens toppscorere. Ingen fritekst-fallback — ukoblede brukere
    // (topscorer_player_id == null) får 0 toppscorer-poeng.
    function riktigTopscorer(playerId: number | null | undefined) {
        return playerId != null && topscorerPlayerIds.includes(playerId)
    }
    const topscorerPointsFun = () => {
        const antallOk = allBets.users.filter((u) => riktigTopscorer(u.topscorer_player_id)).length
        return regnUtBonuspoeng(antallOk, allBets.users.length)
    }
    const poengPerTopscorer = topscorerPointsFun()
    return {
        users: allBets.users.map((u) => {
            let winnerPoints = 0
            let topscorerPoints = 0
            if (riktigWinner(u.winner)) {
                winnerPoints = u.winner_endret ? Math.floor(poengPerVinner / 2) : poengPerVinner
            }
            if (riktigTopscorer(u.topscorer_player_id)) {
                topscorerPoints = u.topscorer_endret ? Math.floor(poengPerTopscorer / 2) : poengPerTopscorer
            }
            return {
                ...u,
                winnerPoints: winnerPoints,
                topscorerPoints: topscorerPoints,
            }
        }),
        bets: betsMedScore,
    }
}
