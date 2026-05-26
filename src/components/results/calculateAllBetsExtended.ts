import { finnUtfall, regnUtScoreForKamp } from './matchScoreCalculator'
import { stringTilNumber } from '../../utils/stringnumber'
import { AllBets, MatchBetMedScore, OtherUser } from '../../queries/useAllBets'
import { winner } from './winner'
import { topscorer } from './topscorer' // "topscorer" er DB-/type-navn (én p); UI bruker "toppscorer"
import { erNorgeKamp } from '../../data/matches'

export interface AllBetsExtended {
    users: OtherUser[]
    bets: MatchBetMedScore[]
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
    const winnerPointsFun = () => {
        const antallOk = allBets.users.filter((u) => u.winner == winner).length
        return regnUtBonuspoeng(antallOk, allBets.users.length)
    }
    const poengPerVinner = winnerPointsFun()
    function riktigTopscorer(userTopscorer: string | undefined) {
        if (!userTopscorer) {
            return false
        }
        return topscorer.some((t) => userTopscorer.toLowerCase().includes(t.toLowerCase()))
    }
    const topscorerPointsFun = () => {
        const antallOk = allBets.users.filter((u) => riktigTopscorer(u.topscorer)).length
        return regnUtBonuspoeng(antallOk, allBets.users.length)
    }
    const poengPerTopscorer = topscorerPointsFun()
    return {
        users: allBets.users.map((u) => {
            let winnerPoints = 0
            let topscorerPoints = 0
            if (u.winner == winner) {
                winnerPoints = poengPerVinner
            }
            if (riktigTopscorer(u.topscorer)) {
                topscorerPoints = poengPerTopscorer
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
