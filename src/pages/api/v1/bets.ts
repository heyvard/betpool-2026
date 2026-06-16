import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { erIFørsteRunde } from '../../../utils/isInFirstRound'
import { serverNå } from '../../../utils/testClock'
import { auth } from '../../../auth/authHandler'
import { hentKamper, erKampPågående } from '../../../data/matches'
import { resolveActiveScore } from '../../../data/matchScore'

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
        synced_home_ft: number | null
        synced_away_ft: number | null
        use_manual: boolean
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
        winner_forrige?: string
        topscorer_forrige?: string
        i_hovedliga: boolean
    }

    const [betRows, scoreRows, userRows] = await Promise.all([
        client.query<BetRow>(`
            SELECT b.user_id, b.match_num, b.home_score, b.away_score, b.joker
            FROM bets b
            JOIN users u ON u.id = b.user_id
            WHERE u.active = true`),
        client.query<ScoreRow>(`
            SELECT match_num, home_score, away_score, home_team_override, away_team_override,
                   synced_home_ft, synced_away_ft, use_manual
            FROM match_scores`),
        client.query<User>(`
            SELECT u.id, COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name, u.paid, u.picture, u.winner, u.topscorer,
                   u.winner_endret, u.topscorer_endret, u.winner_forrige, u.topscorer_forrige, u.i_hovedliga
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
            const resultat = score ? resolveActiveScore(score) : { home_score: null, away_score: null }
            // Mens kampen pågår er poengene foreløpige (live) — uavhengig av om
            // resultatet er synket fra football-data.org, satt manuelt av en
            // scoreadmin, eller ikke satt ennå (typisk TIMED → 0-0). Først når
            // kampen er ferdig (FINISHED/AWARDED) regnes poengene som endelige.
            const foreløpig = erKampPågående(jsonMatch.status)
            const homeResult = resultat.home_score ?? (foreløpig ? 0 : null)
            const awayResult = resultat.away_score ?? (foreløpig ? 0 : null)
            return {
                user_id: b.user_id,
                match_num: b.match_num,
                game_start: jsonMatch.game_start,
                home_team: score?.home_team_override ?? jsonMatch.home_team,
                away_team: score?.away_team_override ?? jsonMatch.away_team,
                round: jsonMatch.round,
                home_score: b.home_score,
                away_score: b.away_score,
                home_result: homeResult,
                away_result: awayResult,
                joker: b.joker,
                foreløpig,
            }
        })
        .filter(Boolean)

    const userList = userRows.rows
    if (await erIFørsteRunde(client, req)) {
        userList.forEach((u) => {
            delete u.winner
            delete u.topscorer
            delete u.winner_forrige
            delete u.topscorer_forrige
        })
    }

    res.json({ bets, users: userList })
}

export default auth(handler)
