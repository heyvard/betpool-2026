import { ApiHandlerOpts } from '../../../../../../types/apiHandlerOpts'
import { serverNå } from '../../../../../../utils/testClock'
import { auth } from '../../../../../../auth/authHandler'
import { erNorgeKamp, hentKamp, hentKampnumreIRunde, kanHaJoker } from '../../../../../../data/matches'
import { loggEndring } from '../../../../../../data/auditLog'

// Setter eller fjerner jokeren på en kamp. Jokeren dobler kamppoengene, og hver
// bruker kan ha nøyaktig én joker per runde. Når jokerkampen har startet er
// jokeren låst — den kan ikke lenger flyttes til en annen kamp i samme runde.
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
    const joker = reqBody.joker
    if (typeof joker !== 'boolean') {
        res.status(400).json({ error: 'joker må være true eller false' })
        return
    }

    const match = await hentKamp(client, matchNum)
    if (!match) {
        res.status(404).json({ error: 'match not found' })
        return
    }

    const now = serverNå(req)
    if (new Date(match.game_start) <= now) {
        res.status(403).json({ error: 'game has started' })
        return
    }

    const harBet = await client.query<{ joker: boolean }>(
        `SELECT joker FROM bets WHERE user_id = $1 AND match_num = $2`,
        [user.id, matchNum],
    )
    if (harBet.rowCount === 0) {
        res.status(409).json({ error: 'Du må tippe kampen før du kan bruke joker.' })
        return
    }
    const jokerFør = harBet.rows[0].joker

    if (!joker) {
        await client.query(`UPDATE bets SET joker = false WHERE user_id = $1 AND match_num = $2`, [user.id, matchNum])
        await loggEndring(client, {
            actorUserId: user.id,
            entitet: 'bet',
            entitetNøkkel: `${user.id}:${matchNum}`,
            handling: 'fjern_joker',
            før: { joker: jokerFør },
            etter: { joker: false },
        })
        res.status(200).json({ ok: true })
        return
    }

    // joker = true: bare til og med åttendedelsfinalene.
    if (!kanHaJoker(match.round)) {
        res.status(409).json({ error: 'joker er ikke tilgjengelig i denne kampen' })
        return
    }

    // Norge-kamper teller alt dobbelt for alle — joker er ikke tillatt der.
    if (erNorgeKamp(match.home_team, match.away_team)) {
        res.status(409).json({ error: 'Joker er ikke tilgjengelig på Norge-kamper.' })
        return
    }

    // Håndhev «én joker per runde». Finn en evt. eksisterende joker i runden.
    const rundensKamper = await hentKampnumreIRunde(client, match.round)
    const eksisterende = await client.query<{ match_num: number }>(
        `SELECT match_num FROM bets
         WHERE user_id = $1 AND joker = true AND match_num = ANY($2::int[])`,
        [user.id, rundensKamper],
    )

    // En joker som ligger på en kamp som alt har startet er låst og kan ikke flyttes.
    const andreJokerKamper = eksisterende.rows.filter((rad) => rad.match_num !== matchNum)
    const annenKamper = await Promise.all(andreJokerKamper.map((rad) => hentKamp(client, rad.match_num)))
    const låst = annenKamper.some((annen) => annen != null && new Date(annen.game_start) <= now)
    if (låst) {
        res.status(409).json({ error: 'jokeren er allerede låst for denne runden' })
        return
    }

    await client.query(
        `UPDATE bets SET joker = false
         WHERE user_id = $1 AND joker = true AND match_num = ANY($2::int[])`,
        [user.id, rundensKamper],
    )
    await client.query(`UPDATE bets SET joker = true WHERE user_id = $1 AND match_num = $2`, [user.id, matchNum])

    const flyttetFra = eksisterende.rows.map((r) => r.match_num).filter((n) => n !== matchNum)
    await loggEndring(client, {
        actorUserId: user.id,
        entitet: 'bet',
        entitetNøkkel: `${user.id}:${matchNum}`,
        handling: 'sett_joker',
        før: { joker: jokerFør, joker_var_på_kamp: flyttetFra },
        etter: { joker: true },
    })

    res.status(200).json({ ok: true })
}

export default auth(handler)
