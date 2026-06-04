import { ApiHandlerOpts } from '../../../types/apiHandlerOpts'
import { auth } from '../../../auth/authHandler'
import { sendPushTilBruker } from '../../../server/push'
import { hentTilbakemeldinger, lagreTilbakemelding } from '../../../data/feedback'

const MAKS_LENGDE = 5000

const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { res, req, user, client } = opts
    if (!user) {
        res.status(401).end()
        return
    }

    if (req.method === 'POST') {
        const reqBody = JSON.parse(req.body)
        const message = typeof reqBody.message === 'string' ? reqBody.message.trim() : ''
        if (!message) {
            res.status(400).json({ error: 'tom_melding' })
            return
        }
        if (message.length > MAKS_LENGDE) {
            res.status(400).json({ error: 'for_lang' })
            return
        }

        await lagreTilbakemelding(client, user.id, message)
        res.status(201).json({ ok: true })

        // Varsle superadmins — samme mønster som «Ny bruker registrert» i me.ts.
        // En feil her skal ikke gå ut over at tilbakemeldingen ble lagret.
        try {
            const superadmins = await client.query<{ id: string }>(
                `SELECT id FROM users WHERE superadmin = true AND notif_general = true`,
            )
            const avsender = user.kallenavn?.trim() || user.name
            await Promise.all(
                superadmins.rows.map((sa) =>
                    sendPushTilBruker(client, sa.id, {
                        title: 'Ny tilbakemelding',
                        body: `${avsender} sendte en tilbakemelding.`,
                        url: '/tilbakemeldinger',
                    }).catch((err) => console.error('Push til superadmin feilet:', err)),
                ),
            )
        } catch (err) {
            console.error('Feil ved varsling av superadmins om tilbakemelding:', err)
        }
        return
    }

    if (req.method === 'GET') {
        if (!user.superadmin) {
            res.status(403).end()
            return
        }
        res.json(await hentTilbakemeldinger(client))
        return
    }

    res.status(405).end()
}

export default auth(handler)
