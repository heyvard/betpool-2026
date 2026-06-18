import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'
import { hentSpillere } from '../../../../data/players'
import { syncPlayers } from '../../../../server/syncPlayers'

const handler = async function ({ req, user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user?.superadmin) {
        res.status(403).end()
        return
    }

    if (req.method === 'POST') {
        // Engangsjobb: synk alle trupper fra football-data.org til `players`.
        console.log(`[admin/players] synk manuelt trigget av ${user.email}`)
        try {
            const resultat = await syncPlayers(client)
            res.status(200).json(resultat)
        } catch (e) {
            console.error('[admin/players] synk feilet', e)
            res.status(500).json({ error: 'intern feil' })
        }
        return
    }

    const spillere = await hentSpillere(client)
    res.status(200).json(spillere)
}

export default auth(handler)
