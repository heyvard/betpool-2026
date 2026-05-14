import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { getMatches, getMatchMap } from '../../../../data/matches'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, client } = opts

    if (!user) {
        res.status(401)
        return
    }

    interface BetRow {
        match_num: number
        home_score: number | null
        away_score: number | null
        bet_id: string
    }

    const betRows = (
        await client.query<BetRow>(
            `SELECT b.match_num, b.home_score, b.away_score, b.id bet_id
             FROM bets b
             JOIN users u ON u.id = b.user_id
             WHERE b.user_id = $1
               AND u.active = true
             ORDER BY b.match_num ASC`,
            [user.id],
        )
    ).rows

    const matchMap = getMatchMap()
    const matchList = getMatches()

    const scoreRows = (
        await client.query<{ match_num: number; home_team_override: string | null; away_team_override: string | null }>(
            `SELECT match_num, home_team_override, away_team_override FROM match_scores`,
        )
    ).rows
    const overrideMap = new Map(scoreRows.map((s) => [s.match_num, s]))

    const bets = betRows
        .map((b) => {
            const jsonMatch = matchMap.get(b.match_num)
            if (!jsonMatch) return null
            const override = overrideMap.get(b.match_num)
            return {
                game_start: jsonMatch.game_start,
                home_team: override?.home_team_override ?? jsonMatch.home_team,
                away_team: override?.away_team_override ?? jsonMatch.away_team,
                round: jsonMatch.round,
                home_score: b.home_score,
                away_score: b.away_score,
                match_num: b.match_num,
                bet_id: b.bet_id,
            }
        })
        .filter(Boolean)

    bets.sort((a, b) => {
        if (!a || !b) return 0
        const matchA = matchList.find((m) => m.match_num === a.match_num)
        const matchB = matchList.find((m) => m.match_num === b.match_num)
        if (!matchA || !matchB) return 0
        return new Date(matchA.game_start).getTime() - new Date(matchB.game_start).getTime()
    })

    res.status(200).json(bets)
}

export default auth(handler)
