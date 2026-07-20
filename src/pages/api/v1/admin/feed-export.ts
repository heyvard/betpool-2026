import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { hentFeed } from '../../../../server/feed/hentFeed'
import { byggAlleBets } from '../../../../server/bets/byggAlleBets'
import { calculateAllBetsExtended, filtrerAllBets } from '../../../../components/results/calculateAllBetsExtended'
import { calculateLeaderboard } from '../../../../components/results/calculateAllScores'
import { AllBets } from '../../../../queries/useAllBets'

// GET /api/v1/admin/feed-export — superadmin: hele feeden sammen med metadata
// (leaderboard) beregnet server-side. Ment for debugging/eksport. ?download=1 gir
// fila som vedlegg slik at selve URL-en laster ned.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user, client } = opts
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }
    // Mock-modus har ingen DB-klient — tom feed/leaderboard.
    if (!client) {
        res.json({ posts: [], metadata: { leaderboard: [], generertAt: new Date().toISOString() } })
        return
    }

    const [posts, alleBets] = await Promise.all([
        hentFeed(client, user.id),
        // Admin skal se ekte leaderboard (med winner/topscorer-bonus), ikke
        // første-runde-maskert data.
        byggAlleBets(client, req, { skjulFørsteRundePicks: false }),
    ])

    // Normaliser null-resultat til 0 før poengberegning, slik UseAllBets gjør på
    // klienten — ellers blir poengene feil. Castes til AllBets fordi
    // calculateAllBetsExtended bruker løs likhet (==) på resultat/score.
    const allBets = {
        users: alleBets.users,
        bets: alleBets.bets.map((b) => ({
            ...b,
            home_result: b.home_result ?? 0,
            away_result: b.away_result ?? 0,
        })),
        tournamentResult: alleBets.tournamentResult,
    } as unknown as AllBets

    const hovedligaIds = new Set(allBets.users.map((u) => u.id))
    const extended = calculateAllBetsExtended(filtrerAllBets(allBets, hovedligaIds))
    const leaderboard = calculateLeaderboard(extended.bets, extended.users)

    if (req.query.download === '1') {
        const dato = new Date().toISOString().slice(0, 10)
        res.setHeader('Content-Disposition', `attachment; filename="betpool-feed-export-${dato}.json"`)
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
    }

    res.json({ posts, metadata: { leaderboard, generertAt: new Date().toISOString() } })
}

export default auth(handler)
