import { ApiHandlerOpts } from '../../../../../types/apiHandlerOpts'
import { auth } from '../../../../../auth/authHandler'
import { hentKamperFraApi, syncAll } from '../../../../../server/syncAll'
import { syncMatches } from '../../../../../server/syncMatches'
import { syncScores } from '../../../../../server/syncScores'

// syncAll → genererFeedTrygt kan fyre den AI-genererte morgenrapporten (Claude) når
// nattens siste kamp blir ferdig — det kallet tar titalls sekunder. Gi ruten rikelig
// tid så den ikke drepes midt i kallet. Claude-kallet er hardt tidsavbrutt på 55 s.
export const config = {
    maxDuration: 60,
}

const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    const dryRun = req.query.dryRun === 'true'
    console.log(`[admin/cron/sync] manuelt trigget av ${user.email}${dryRun ? ' (dry run)' : ''}`)
    try {
        if (dryRun) {
            const kamper = await hentKamperFraApi()
            const [matchResultat, scoresResultat] = await Promise.all([
                syncMatches(client, true, kamper),
                syncScores(client, true, kamper),
            ])
            res.status(200).json({ kamper: matchResultat, scores: scoresResultat })
        } else {
            const resultat = await syncAll(client)
            res.status(200).json(resultat)
        }
    } catch (e) {
        console.error('[admin/cron/sync] feilet', e)
        res.status(500).json({ error: 'intern feil' })
    }
}

export default auth(handler)
