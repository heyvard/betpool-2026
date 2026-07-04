import { MatchBetMedScore, OtherUser } from '../../queries/useAllBets'

export interface BesteTippRad {
    bet: MatchBetMedScore
    userName: string
    userPicture: string | null
}

export interface VerdifullKampRad {
    match_num: number
    home_team: string
    away_team: string
    home_score: number | null
    away_score: number | null
    round: number
    totalPoeng: number
    antallBets: number
}

/** Topp N enkelttips etter poeng, med bruker slått opp for visning. Kun ferdigspilte kamper. */
export function beregnBesteTips(bets: MatchBetMedScore[], users: OtherUser[], antall = 20): BesteTippRad[] {
    const brukerMap = new Map(users.map((u) => [u.id, u]))
    return bets
        .filter((b) => !b.foreløpig)
        .sort((a, b) => b.poeng - a.poeng || a.match_num - b.match_num || a.user_id.localeCompare(b.user_id))
        .slice(0, antall)
        .map((bet) => {
            const bruker = brukerMap.get(bet.user_id)
            return {
                bet,
                userName: bruker?.name ?? bet.user_id,
                userPicture: bruker?.picture ?? null,
            }
        })
}

/** Topp N kamper etter total poengsum utdelt over alle brukeres tips på kampen. Kun ferdigspilte kamper. */
export function beregnVerdifulleKamper(bets: MatchBetMedScore[], antall = 20): VerdifullKampRad[] {
    const perKamp = new Map<number, VerdifullKampRad>()
    for (const bet of bets) {
        if (bet.foreløpig) continue
        const eksisterende = perKamp.get(bet.match_num)
        if (eksisterende) {
            eksisterende.totalPoeng += bet.poeng
            eksisterende.antallBets += 1
        } else {
            perKamp.set(bet.match_num, {
                match_num: bet.match_num,
                home_team: bet.home_team,
                away_team: bet.away_team,
                home_score: bet.home_score,
                away_score: bet.away_score,
                round: bet.round,
                totalPoeng: bet.poeng,
                antallBets: 1,
            })
        }
    }
    return [...perKamp.values()]
        .sort((a, b) => b.totalPoeng - a.totalPoeng || a.match_num - b.match_num)
        .slice(0, antall)
}
