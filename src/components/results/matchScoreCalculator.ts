import { MatchBet } from '../../queries/useAllBets'

export type Utfall = 'H' | 'U' | 'B'

export interface MatchPoeng {
    matchid: string
    riktigUtfall: number
    riktigResultat: number
    antallRiktigeSvar: number
    antallRiktigeUtfall: number
    andelRiktigeUtfall: number
    andelRiktigeResultat: number
    utfall: Utfall | null
    hjemme: number
    uavgjort: number
    borte: number
}

export function finnUtfall(home: String, away: String): Utfall {
    const tallHome = Number(home)
    const tallAway = Number(away)
    if (tallHome > tallAway) {
        return 'H'
    }
    if (tallHome < tallAway) {
        return 'B'
    }
    return 'U'
}

export function regnUtScoreForKamp(bets: MatchBet[]): Map<string, MatchPoeng> {
    const matchMap = new Map<string, MatchBet[]>()

    bets.forEach((bet) => matchMap.set(String(bet.match_num), []))
    bets.forEach((bet) => matchMap.get(String(bet.match_num))?.push(bet))

    const res = [] as MatchPoeng[]
    matchMap.forEach((bets, match) => {
        const homeResult = bets[0].home_result
        const awayResult = bets[0].away_result

        let hjemme = 0
        let uavgjort = 0
        let borte = 0
        bets.forEach((b) => {
            if (b.home_score != null && b.away_score != null) {
                const utfall = finnUtfall(b.home_score, b.away_score)
                if (utfall == 'H') {
                    hjemme++
                }
                if (utfall == 'U') {
                    uavgjort++
                }
                if (utfall == 'B') {
                    borte++
                }
            }
        })

        if (homeResult == null || awayResult == null) {
            res.push({
                matchid: match,
                riktigUtfall: 0,
                riktigResultat: 0,
                antallRiktigeSvar: 0,
                antallRiktigeUtfall: 0,
                andelRiktigeUtfall: 0,
                andelRiktigeResultat: 0,
                utfall: null,
                hjemme,
                uavgjort,
                borte,
            })
        } else {
            let riktigeSvar = 0
            let riktigeUtfall = 0
            let utfall = finnUtfall(homeResult, awayResult)

            const round = bets[0].round

            const finnVekting = () => {
                switch (round) {
                    case 4:
                        return 2
                    case 5:
                        return 2
                    case 6:
                        return 3
                    case 7:
                        return 3
                    case 8:
                        return 3
                    case 9:
                        return 4
                }
                return 1
            }
            const vekting = finnVekting()
            let faktiskeBets = 0
            bets.forEach((b) => {
                const riktig = b.home_result == b.home_score && b.away_result == b.away_score
                if (riktig) {
                    riktigeSvar++
                }
                if (b.home_score != null && b.away_score != null) {
                    faktiskeBets++
                    const betUtfall = finnUtfall(b.home_score, b.away_score)
                    if (betUtfall == utfall) {
                        riktigeUtfall++
                    }
                }
            })

            const andelRiktigeResultat = riktigeSvar / faktiskeBets
            const andelRiktigeUtfall = riktigeUtfall / faktiskeBets
            // Forslag 3: trapp på eksakt resultat — skiller alene fra «flere traff».
            const riktigResultat = () => {
                if (riktigeSvar === 1) {
                    return vekting * 5
                }
                if (andelRiktigeResultat < 0.05) {
                    return vekting * 4
                }
                if (andelRiktigeResultat < 0.15) {
                    return vekting * 3
                }
                if (andelRiktigeResultat < 0.3) {
                    return vekting * 2
                }
                return vekting
            }

            // Forslag 4: tre trinn på utfall — belønner «umulige» treff bedre.
            const riktigUtfall = () => {
                if (andelRiktigeUtfall < 0.1) {
                    return vekting * 3
                }
                if (andelRiktigeUtfall < 0.2) {
                    return vekting * 2
                }
                return vekting
            }

            res.push({
                matchid: match,
                riktigUtfall: riktigUtfall(),
                riktigResultat: riktigResultat(),
                antallRiktigeSvar: riktigeSvar,
                antallRiktigeUtfall: riktigeUtfall,
                andelRiktigeUtfall: andelRiktigeUtfall,
                andelRiktigeResultat: andelRiktigeResultat,
                utfall: utfall,
                hjemme,
                uavgjort,
                borte,
            })
        }
    })

    const mappet = new Map<string, MatchPoeng>()
    res.forEach((a) => {
        mappet.set(a.matchid, a)
    })
    return mappet
}
