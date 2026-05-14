import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { getMatches } from '../../../data/matches'

interface ScoreRow {
    match_num: number
    home_score: number | null
    away_score: number | null
    home_team_override: string | null
    away_team_override: string | null
}

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }

    const scores = (
        await client.query<ScoreRow>(
            `SELECT match_num, home_score, away_score, home_team_override, away_team_override
             FROM match_scores`,
        )
    ).rows

    const scoreMap = new Map<number, ScoreRow>(scores.map((s) => [s.match_num, s]))

    const matches = getMatches().map((m) => {
        const score = scoreMap.get(m.match_num)
        return {
            ...m,
            home_team: score?.home_team_override ?? m.home_team,
            away_team: score?.away_team_override ?? m.away_team,
            home_score: score?.home_score ?? null,
            away_score: score?.away_score ?? null,
        }
    })

    res.status(200).json(matches)
}

export default auth(handler)
