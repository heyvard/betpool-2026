import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { getMatchByNum } from '../../../../../data/matches'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401)
        return
    }

    const { id } = req.query
    const reqBody = JSON.parse(req.body)

    const betRow = (
        await client.query<{ match_num: number }>(`SELECT match_num FROM bets WHERE id = $1 AND user_id = $2`, [
            id,
            user.id,
        ])
    ).rows[0]

    if (!betRow) {
        res.status(404).json({ error: 'bet not found' })
        return
    }

    const match = getMatchByNum(betRow.match_num)
    if (!match || new Date(match.game_start) <= new Date()) {
        res.status(403).json({ error: 'game has started' })
        return
    }

    await client.query(`UPDATE bets SET home_score = $1, away_score = $2 WHERE user_id = $3 AND id = $4`, [
        reqBody.home_score,
        reqBody.away_score,
        user.id,
        id,
    ])
    res.status(200).json({ ok: 123 })
}

export default auth(handler)
