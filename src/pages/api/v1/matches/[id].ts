import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401)
        return
    }

    if (!user.scoreadmin) {
        res.status(403)
        return
    }

    const matchNum = Number(req.query.id)
    if (!Number.isInteger(matchNum) || matchNum < 1) {
        res.status(400).json({ error: 'invalid match_num' })
        return
    }

    const reqBody = JSON.parse(req.body)

    const updates: Record<string, number | string | null> = {}
    if (typeof reqBody.home_score !== 'undefined') updates.home_score = reqBody.home_score
    if (typeof reqBody.away_score !== 'undefined') updates.away_score = reqBody.away_score
    if (typeof reqBody.home_team !== 'undefined') updates.home_team_override = reqBody.home_team
    if (typeof reqBody.away_team !== 'undefined') updates.away_team_override = reqBody.away_team

    if (Object.keys(updates).length === 0) {
        res.status(200).json({ ok: true })
        return
    }

    const setClauses = Object.keys(updates)
        .map((col, i) => `${col} = $${i + 2}`)
        .join(', ')
    const values = [matchNum, ...Object.values(updates)]

    await client.query(
        `INSERT INTO match_scores (match_num, updated_at)
         VALUES ($1, now())
         ON CONFLICT (match_num) DO UPDATE SET ${setClauses}, updated_at = now()`,
        values,
    )

    res.status(200).json({ ok: true })
}

export default auth(handler)
