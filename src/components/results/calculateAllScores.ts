import { MatchBetMedScore, OtherUser } from '../../queries/useAllBets'

export interface LeaderBoard {
    userid: string
    poeng: number
    userName: string
    paid: boolean
    picture: string | null
    // Delen av `poeng` som kommer fra kamper som fortsatt pågår (foreløpige poeng).
    livePoeng?: number
}

export function calculateLeaderboard(bets: MatchBetMedScore[], users: OtherUser[]): LeaderBoard[] {
    const userMap = new Map<string, MatchBetMedScore[]>()
    if (bets.length == 0) {
        return users.map((u) => {
            return {
                userid: u.id,
                poeng: 0,
                livePoeng: 0,
                userName: u.name,
                paid: u.paid,
                picture: u.picture,
            }
        })
    }
    bets.forEach((bet) => userMap.set(bet.user_id, []))
    bets.forEach((bet) => userMap.get(bet.user_id)?.push(bet))
    const otherUserMap = new Map<string, OtherUser>()
    users.forEach((u) => {
        otherUserMap.set(u.id, u)
    })
    const res = [] as LeaderBoard[]
    userMap.forEach((bets, user) => {
        let poeng = 0
        let livePoeng = 0
        bets.forEach((b) => {
            poeng = poeng + b.poeng
            // Foreløpige poeng: kampen pågår ennå (live synket delresultat).
            if (b.foreløpig) {
                livePoeng = livePoeng + b.poeng
            }
        })
        users.forEach((u) => {
            if (u.id == user) {
                // Winner/topscorer-bonus avgjøres ved turneringsslutt og regnes ikke som foreløpig.
                poeng = poeng + (u.winnerPoints || 0) + (u.topscorerPoints || 0)
            }
        })

        res.push({
            userid: user,
            poeng,
            livePoeng,
            userName: otherUserMap.get(user)?.name || 'unknown',
            paid: otherUserMap.get(user)?.paid || false,
            picture: otherUserMap.get(user)?.picture || null,
        })
    })
    return res.sort((a, b) => b.poeng - a.poeng)
}
