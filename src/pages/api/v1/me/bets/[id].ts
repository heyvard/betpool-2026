import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { serverNå } from '../../../../../utils/testClock'
import { auth } from '../../../../../auth/authHandler'
import { getMatchByNum } from '../../../../../data/matches'

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

    const match = getMatchByNum(matchNum)
    if (!match) {
        res.status(404).json({ error: 'match not found' })
        return
    }
    if (new Date(match.game_start) <= serverNå(req)) {
        res.status(403).json({ error: 'game has started' })
        return
    }

    await client.query(
        `INSERT INTO bets (user_id, match_num, home_score, away_score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, match_num)
         DO UPDATE SET home_score = $3, away_score = $4`,
        [user.id, matchNum, homeScore, awayScore],
    )
    res.status(200).json({ ok: 123 })
}

export default auth(handler)
