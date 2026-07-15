import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { byggAlleBets } from '../../../server/bets/byggAlleBets'

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { req, res, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }

    const { bets, users, tournamentResult } = await byggAlleBets(client, req)
    res.json({ bets, users, tournamentResult })
}

export default auth(handler)
