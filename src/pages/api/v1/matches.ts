import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { hentKamper } from '../../../data/matches'
import { resolveActiveScore } from '../../../data/matchScore'
import { MatchAdminData } from '../../../types/types'

interface ScoreRow {
    match_num: number
    home_score: number | null
    away_score: number | null
    home_team_override: string | null
    away_team_override: string | null
    synced_home_ft: number | null
    synced_away_ft: number | null
    synced_home_et: number | null
    synced_away_et: number | null
    synced_home_pen: number | null
    synced_away_pen: number | null
    synced_duration: string | null
    score_synced_at: string | null
    use_manual: boolean
}

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }

    const scores = (
        await client.query<ScoreRow>(
            `SELECT match_num, home_score, away_score,
                    home_team_override, away_team_override,
                    synced_home_ft, synced_away_ft,
                    synced_home_et, synced_away_et,
                    synced_home_pen, synced_away_pen,
                    synced_duration, score_synced_at,
                    use_manual
             FROM match_scores`,
        )
    ).rows

    const scoreMap = new Map<number, ScoreRow>(scores.map((s) => [s.match_num, s]))

    const matches = (await hentKamper(client)).map((m) => {
        const score = scoreMap.get(m.match_num)
        const resolved = score ? resolveActiveScore(score) : { home_score: null, away_score: null }

        const base = {
            ...m,
            home_team: score?.home_team_override ?? m.home_team,
            away_team: score?.away_team_override ?? m.away_team,
            home_score: resolved.home_score,
            away_score: resolved.away_score,
        }

        if (!user.scoreadmin || !score) return base

        const adminData: MatchAdminData = {
            manual_home_score: score.home_score,
            manual_away_score: score.away_score,
            synced_home_ft: score.synced_home_ft,
            synced_away_ft: score.synced_away_ft,
            synced_home_et: score.synced_home_et,
            synced_away_et: score.synced_away_et,
            synced_home_pen: score.synced_home_pen,
            synced_away_pen: score.synced_away_pen,
            synced_duration: score.synced_duration,
            score_synced_at: score.score_synced_at,
            use_manual: score.use_manual,
        }

        return { ...base, adminData }
    })

    res.status(200).json(matches)
}

export default auth(handler)
