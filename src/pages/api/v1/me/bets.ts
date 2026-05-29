import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { hentKamper } from '../../../../data/matches'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    interface BetRow {
        match_num: number
        home_score: number | null
        away_score: number | null
        joker: boolean
    }

    const betRows = (
        await client.query<BetRow>(
            `SELECT b.match_num, b.home_score, b.away_score, b.joker
             FROM bets b
             JOIN users u ON u.id = b.user_id
             WHERE b.user_id = $1
               AND u.active = true`,
            [user.id],
        )
    ).rows
    const betMap = new Map(betRows.map((b) => [b.match_num, b]))

    const scoreRows = (
        await client.query<{ match_num: number; home_team_override: string | null; away_team_override: string | null }>(
            `SELECT match_num, home_team_override, away_team_override FROM match_scores`,
        )
    ).rows
    const overrideMap = new Map(scoreRows.map((s) => [s.match_num, s]))

    const bets = (await hentKamper(client))
        .map((match) => {
            const bet = betMap.get(match.match_num)
            const override = overrideMap.get(match.match_num)
            return {
                game_start: match.game_start,
                home_team: override?.home_team_override ?? match.home_team,
                away_team: override?.away_team_override ?? match.away_team,
                round: match.round,
                home_score: bet?.home_score ?? null,
                away_score: bet?.away_score ?? null,
                match_num: match.match_num,
                joker: bet?.joker ?? false,
            }
        })
        .sort((a, b) => new Date(a.game_start).getTime() - new Date(b.game_start).getTime())

    res.status(200).json(bets)
}

export default auth(handler)
