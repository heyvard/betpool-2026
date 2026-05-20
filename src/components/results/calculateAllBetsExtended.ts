import { finnUtfall, regnUtScoreForKamp } from './matchScoreCalculator'
import { stringTilNumber } from '../../utils/stringnumber'
import { AllBets, MatchBetMedScore, OtherUser } from '../../queries/useAllBets'
import { winner } from './winner'
import { topscorer } from './topscorer'

export interface AllBetsExtended {
    users: OtherUser[]
    bets: MatchBetMedScore[]
}

export function calculateAllBetsExtended(allBets: AllBets): AllBetsExtended {
    let scoreForKamp = regnUtScoreForKamp(allBets.bets)
    const betsMedScore = allBets.bets
        .map((b) => {
            return {
                ...b,
                home_result: b.home_result || '0',
                away_result: b.away_result || '0',
            }
        })
        .map((b): MatchBetMedScore => {
            if (b.home_score == null || b.away_score == null) {
                return {
                    ...b,
                    away_score: stringTilNumber(b.away_score),
                    home_score: stringTilNumber(b.home_score),
                    poeng: 0,
                    riktigResultat: false,
                    riktigUtfall: false,
                    joker: b.joker ?? false,
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
                const joker = b.joker ?? false
                if (joker) {
                    poeng = poeng * 2
                }
                return {
                    ...b,
                    away_score: stringTilNumber(b.away_score),
                    home_score: stringTilNumber(b.home_score),
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
        if (antallOk == 0) {
            return 0
        }
        return Math.min(Math.ceil((allBets.users.length * 3) / antallOk), 15)
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
        if (antallOk == 0) {
            return 0
        }
        return Math.min(Math.ceil((allBets.users.length * 3) / antallOk), 15)
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
