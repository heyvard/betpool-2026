import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { erIFørsteRunde } from '../../../utils/isInFirstRound'

// Fordelingen av hele ligaens vinner- og toppscorer-tips: ett innslag per unikt
// valg, med navnene på deltakerne bak. Brukes av /alle-tips.
//
// Samme synlighetsgaranti som /api/v1/bets: så lenge erIFørsteRunde er sann
// (frem til starten på runde 2) er andres vinner/toppscorer hemmelig — da
// returnerer vi en tom fordeling slik at ingenting lekker.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }

    interface TipsValg {
        navn: string
        antall: number
        deltakere: string[]
        /** Delmengde av `deltakere` som har brukt byttet sitt for denne kategorien. */
        byttere: string[]
    }

    if (await erIFørsteRunde(client, req)) {
        res.json({ totaltAntall: 0, vinner: [], toppscorer: [] })
        return
    }

    interface Rad {
        name: string
        winner: string | null
        topscorer_name: string | null
        winner_endret: boolean
        topscorer_endret: boolean
    }

    const { rows } = await client.query<Rad>(`
        SELECT COALESCE(NULLIF(u.kallenavn, ''), u.name) AS name, u.winner, p.name AS topscorer_name,
               u.winner_endret, u.topscorer_endret
        FROM users u
        LEFT JOIN players p ON p.id = u.topscorer_player_id
        WHERE u.active = true`)

    // Grupperer på valg → deltakerlisten bak hvert valg. Bevarer
    // innsettingsrekkefølgen (Map); UI sorterer selv på antall.
    const grupper = (velg: (r: Rad) => string | null | undefined, harByttet: (r: Rad) => boolean): TipsValg[] => {
        const map = new Map<string, string[]>()
        const bytteMap = new Map<string, string[]>()
        for (const r of rows) {
            const valg = velg(r)
            if (!valg) continue
            const liste = map.get(valg)
            if (liste) liste.push(r.name)
            else map.set(valg, [r.name])
            if (harByttet(r)) {
                const bytteListe = bytteMap.get(valg)
                if (bytteListe) bytteListe.push(r.name)
                else bytteMap.set(valg, [r.name])
            }
        }
        return [...map.entries()].map(([navn, deltakere]) => ({
            navn,
            antall: deltakere.length,
            deltakere,
            byttere: bytteMap.get(navn) ?? [],
        }))
    }

    const totaltAntall = rows.filter((r) => r.winner || r.topscorer_name).length

    res.json({
        totaltAntall,
        vinner: grupper(
            (r) => r.winner,
            (r) => r.winner_endret,
        ),
        toppscorer: grupper(
            (r) => r.topscorer_name,
            (r) => r.topscorer_endret,
        ),
    })
}

export default auth(handler)
