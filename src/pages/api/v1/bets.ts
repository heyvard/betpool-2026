import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { erIFørsteRunde } from '../../../utils/isInFirstRound'
import { serverNå } from '../../../utils/testClock'
import { auth } from '../../../auth/authHandler'
import { hentKamper } from '../../../data/matches'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }

    interface BetRow {
        user_id: string
        match_num: number
        home_score: string | null
        away_score: string | null
        joker: boolean
    }

    interface ScoreRow {
        match_num: number
        home_score: number | null
        away_score: number | null
        home_team_override: string | null
        away_team_override: string | null
    }

    interface User {
        id: string
        name: string
        paid: boolean
        picture: string
        winner?: string
        topscorer?: string
        winner_endret: boolean
        topscorer_endret: boolean
    }

    const [betRows, scoreRows, userRows] = await Promise.all([
        client.query<BetRow>(`
            SELECT b.user_id, b.match_num, b.home_score, b.away_score, b.joker
            FROM bets b
            JOIN users u ON u.id = b.user_id
            WHERE u.active = true`),
        client.query<ScoreRow>(`
            SELECT match_num, home_score, away_score, home_team_override, away_team_override
            FROM match_scores`),
        client.query<User>(`
            SELECT u.id, u.name, u.paid, u.picture, u.winner, u.topscorer,
                   u.winner_endret, u.topscorer_endret
            FROM users u
            WHERE u.active = true`),
    ])

    const matchList = await hentKamper(client)
    const scoreMap = new Map<number, ScoreRow>(scoreRows.rows.map((s) => [s.match_num, s]))
    const now = serverNå(req)

    const bets = betRows.rows
        .map((b) => {
            const jsonMatch = matchList.find((m) => m.match_num === b.match_num)
            if (!jsonMatch) return null
            if (new Date(jsonMatch.game_start) >= now) return null
            const score = scoreMap.get(b.match_num)
            return {
                user_id: b.user_id,
                match_num: b.match_num,
                game_start: jsonMatch.game_start,
                home_team: score?.home_team_override ?? jsonMatch.home_team,
                away_team: score?.away_team_override ?? jsonMatch.away_team,
                round: jsonMatch.round,
                home_score: b.home_score,
                away_score: b.away_score,
                home_result: score?.home_score ?? null,
                away_result: score?.away_score ?? null,
                joker: b.joker,
            }
        })
        .filter(Boolean)

    const userList = userRows.rows
    if (await erIFørsteRunde(client, req)) {
        userList.forEach((u) => {
            delete u.winner
            delete u.topscorer
        })
    }

    res.json({ bets, users: userList })
}

export default auth(handler)
