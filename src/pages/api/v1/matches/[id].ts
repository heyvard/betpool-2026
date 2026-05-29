import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { loggEndring } from '../../../../data/auditLog'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (!user.scoreadmin) {
        res.status(403).end()
        return
    }

    const matchNum = Number(req.query.id)
    if (!Number.isInteger(matchNum) || matchNum < 1) {
        res.status(400).json({ error: 'invalid match_num' })
        return
    }

    const reqBody = JSON.parse(req.body)

    const updates: Record<string, number | string | boolean | null> = {}
    if (typeof reqBody.home_score !== 'undefined') updates.home_score = reqBody.home_score
    if (typeof reqBody.away_score !== 'undefined') updates.away_score = reqBody.away_score
    if (typeof reqBody.home_team !== 'undefined') updates.home_team_override = reqBody.home_team
    if (typeof reqBody.away_team !== 'undefined') updates.away_team_override = reqBody.away_team
    if (typeof reqBody.use_manual === 'boolean') updates.use_manual = reqBody.use_manual

    if (Object.keys(updates).length === 0) {
        res.status(200).json({ ok: true })
        return
    }

    const cols = Object.keys(updates)
    const insertCols = cols.join(', ')
    const insertPlaceholders = cols.map((_, i) => `$${i + 2}`).join(', ')
    const setClauses = cols.map((col, i) => `${col} = $${i + 2}`).join(', ')
    const values = [matchNum, ...Object.values(updates)]

    const før = await client.query(
        `SELECT home_score, away_score, home_team_override, away_team_override, use_manual
         FROM match_scores WHERE match_num = $1`,
        [matchNum],
    )

    await client.query(
        `INSERT INTO match_scores (match_num, ${insertCols}, updated_at)
         VALUES ($1, ${insertPlaceholders}, now())
         ON CONFLICT (match_num) DO UPDATE SET ${setClauses}, updated_at = now()`,
        values,
    )

    await loggEndring(client, {
        actorUserId: user.id,
        entitet: 'match_score',
        entitetNøkkel: String(matchNum),
        handling: 'sett_resultat',
        før: før.rows[0] ?? null,
        etter: updates,
    })

    res.status(200).json({ ok: true })
}

export default auth(handler)
