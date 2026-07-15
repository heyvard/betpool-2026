import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { loggEndring } from '../../../../data/auditLog'
import { hentTurneringsFasit } from '../../../../data/tournamentResult'
import { alleLag } from '../../../../utils/lag'

// Den faktiske turneringsfasiten (vinner-lag + toppscorer(e)) — superadmin
// setter den her, og calculateAllBetsExtended beregner bonuspoeng ut fra den
// på neste leaderboard-fetch. Ingen poeng lagres eksplisitt noe sted; å lagre
// fasiten ER handlingen som gir poeng. GET leser gjeldende fasit; PUT erstatter
// den fullstendig (vinner + hele toppscorer-settet).
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (!user.superadmin) {
        res.status(403).end()
        return
    }

    if (req.method === 'PUT') {
        const reqBody = JSON.parse(req.body)
        const råWinnerTeam: unknown = reqBody.winnerTeam
        const råTopscorerIds: unknown = reqBody.topscorerPlayerIds

        const winnerTeam = råWinnerTeam === null || råWinnerTeam === undefined ? null : String(råWinnerTeam)
        if (winnerTeam !== null && winnerTeam !== '' && !alleLag.some((l) => l.tla === winnerTeam)) {
            res.status(400).json({ error: 'Ukjent lag' })
            return
        }

        if (!Array.isArray(råTopscorerIds) || !råTopscorerIds.every((id) => Number.isInteger(id))) {
            res.status(400).json({ error: 'topscorerPlayerIds må være en liste med heltall' })
            return
        }
        const topscorerPlayerIds = Array.from(new Set(råTopscorerIds as number[]))

        if (topscorerPlayerIds.length > 0) {
            const finnes = await client.query<{ id: number }>(`SELECT id FROM players WHERE id = ANY($1)`, [
                topscorerPlayerIds,
            ])
            if (finnes.rowCount !== topscorerPlayerIds.length) {
                res.status(400).json({ error: 'Ukjent spiller' })
                return
            }
        }

        const før = await hentTurneringsFasit(client)

        await client.query('BEGIN')
        try {
            await client.query(
                `UPDATE tournament_result SET winner_team_tla = $1, updated_at = now() WHERE id = 'current'`,
                [winnerTeam || null],
            )
            await client.query(`DELETE FROM tournament_topscorers`)
            if (topscorerPlayerIds.length > 0) {
                const placeholders = topscorerPlayerIds.map((_, i) => `($${i + 1})`).join(', ')
                await client.query(
                    `INSERT INTO tournament_topscorers (player_id) VALUES ${placeholders}`,
                    topscorerPlayerIds,
                )
            }
            await client.query('COMMIT')
        } catch (e) {
            await client.query('ROLLBACK')
            throw e
        }

        const etter = { winnerTeam: winnerTeam || '', topscorerPlayerIds: topscorerPlayerIds.sort((a, b) => a - b) }
        if (
            før.winnerTeam !== etter.winnerTeam ||
            JSON.stringify(før.topscorerPlayerIds) !== JSON.stringify(etter.topscorerPlayerIds)
        ) {
            await loggEndring(client, {
                actorUserId: user.id,
                entitet: 'tournament_result',
                entitetNøkkel: 'current',
                handling: 'sett_fasit',
                før,
                etter,
            })
        }

        res.status(200).json({ ok: true })
        return
    }

    const fasit = await hentTurneringsFasit(client)
    res.status(200).json(fasit)
}

export default auth(handler)
