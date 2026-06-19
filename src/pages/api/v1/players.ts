import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { hentSpillere } from '../../../data/players'

// Leser hele spiller-katalogen (players-tabellen). Tilgjengelig for alle innloggede
// brukere — brukes av den strukturerte toppscorer-velgeren på hjemmesiden. Selve
// synken (POST) ligger på det superadmin-gatede /api/v1/admin/players.
const handler = async function ({ user, res, client }: ApiHandlerOpts): Promise<void> {
    if (!user) {
        res.status(401).end()
        return
    }
    const spillere = await hentSpillere(client)
    res.status(200).json(spillere)
}

export default auth(handler)
