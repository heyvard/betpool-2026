import { ApiHandlerOpts } from '../../../../types/apiHandlerOpts'
import { auth } from '../../../../auth/authHandler'

// Oppdaterer hvilke push-kategorier brukeren vil ha varsler for. Tar bare
// imot de feltene som faktisk sendes — øvrige preferanser beholdes som de er.
const handler = async function handler(opts: ApiHandlerOpts): Promise<void> {
    const { user, res, req, client } = opts

    if (!user) {
        res.status(401).end()
        return
    }

    if (req.method !== 'PUT') {
        res.status(405).end()
        return
    }

    const body = req.body ? JSON.parse(req.body) : {}
    const oppdateringer: { kolonne: string; verdi: boolean }[] = []
    for (const felt of ['notif_general', 'notif_reminders', 'notif_summary'] as const) {
        if (typeof body[felt] === 'boolean') {
            oppdateringer.push({ kolonne: felt, verdi: body[felt] })
        }
    }

    if (oppdateringer.length === 0) {
        res.status(400).json({ error: 'ingen gyldige felter' })
        return
    }

    const settKlausuler = oppdateringer.map((o, i) => `${o.kolonne} = $${i + 2}`).join(', ')
    await client.query(`UPDATE users SET ${settKlausuler} WHERE id = $1`, [
        user.id,
        ...oppdateringer.map((o) => o.verdi),
    ])
    res.status(200).json({ ok: true })
}

export default auth(handler)
