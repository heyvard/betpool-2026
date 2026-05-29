import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { serverNå } from '../../../../../utils/testClock'
import { auth } from '../../../../../auth/authHandler'
import { hentKamp } from '../../../../../data/matches'
import { loggEndring } from '../../../../../data/auditLog'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    const matchNum = Number(req.query.id)
    if (!Number.isInteger(matchNum) || matchNum < 1) {
        res.status(400).json({ error: 'invalid match_num' })
        return
    }

    const reqBody = JSON.parse(req.body)

    const homeScore = reqBody.home_score
    const awayScore = reqBody.away_score
    if (
        !Number.isInteger(homeScore) ||
        !Number.isInteger(awayScore) ||
        homeScore < 0 ||
        awayScore < 0 ||
        homeScore > 99 ||
        awayScore > 99
    ) {
        res.status(400).json({ error: 'home_score og away_score må være heltall mellom 0 og 99' })
        return
    }

    const match = await hentKamp(client, matchNum)
    if (!match) {
        res.status(404).json({ error: 'match not found' })
        return
    }
    if (new Date(match.game_start) <= serverNå(req)) {
        res.status(403).json({ error: 'game has started' })
        return
    }

    const scoreRow = await client.query<{ home_team_override: string | null; away_team_override: string | null }>(
        `SELECT home_team_override, away_team_override FROM match_scores WHERE match_num = $1`,
        [matchNum],
    )
    const overrides = scoreRow.rows[0]
    const hjemmelag = overrides?.home_team_override ?? match.home_team
    const bortelag = overrides?.away_team_override ?? match.away_team
    if (!hjemmelag || !bortelag) {
        res.status(403).json({ error: 'lagene er ikke annonsert ennå' })
        return
    }

    const før = await client.query<{ home_score: number; away_score: number }>(
        `SELECT home_score, away_score FROM bets WHERE user_id = $1 AND match_num = $2`,
        [user.id, matchNum],
    )

    await client.query(
        `INSERT INTO bets (user_id, match_num, home_score, away_score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, match_num)
         DO UPDATE SET home_score = $3, away_score = $4`,
        [user.id, matchNum, homeScore, awayScore],
    )

    await loggEndring(client, {
        actorUserId: user.id,
        entitet: 'bet',
        entitetNøkkel: `${user.id}:${matchNum}`,
        handling: før.rowCount === 0 ? 'opprett_tipp' : 'endre_tipp',
        før: før.rows[0] ?? null,
        etter: { home_score: homeScore, away_score: awayScore },
    })

    res.status(200).json({ ok: 123 })
}

export default auth(handler)
