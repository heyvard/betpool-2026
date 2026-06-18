import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { hentStandings } from '../../../server/hentStandings'

// Gruppetabellene er rent avledet data fra football-data.org og brukes ikke i
// scoring — de hentes derfor rett gjennom (med kort cache i hentStandings),
// uten å lagres i databasen. Kallet må gå server-side fordi FOOTBALL_DATA_TOKEN
// er hemmelig.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, user } = opts
    if (!user) {
        res.status(401).end()
        return
    }

    try {
        const grupper = await hentStandings()
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
        res.status(200).json(grupper)
    } catch (e) {
        console.error('[standings] henting feilet', e)
        res.status(502).json({ error: 'kunne ikke hente gruppetabeller' })
    }
}

export default auth(handler)
