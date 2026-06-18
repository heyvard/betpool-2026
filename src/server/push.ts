import webpush from 'web-push'
import { PoolClient } from 'pg'

// Server-only. Må aldri importeres fra klientkode — kun fra API-ruter
// (web-push er en Node-pakke).

let konfigurert = false

function konfigurer() {
    if (konfigurert) return
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT || 'mailto:betpool@example.com'
    if (!publicKey || !privateKey) {
        throw new Error('VAPID-nøkler mangler — sett NEXT_PUBLIC_VAPID_PUBLIC_KEY og VAPID_PRIVATE_KEY')
    }
    webpush.setVapidDetails(subject, publicKey, privateKey)
    konfigurert = true
}

export interface PushPayload {
    title: string
    body: string
    url?: string
}

interface AbonnementRad {
    id: string
    endpoint: string
    p256dh: string
    auth: string
}

// Sender et varsel til alle abonnementene til én bruker. Returnerer antall
// abonnement som faktisk tok imot varselet. Døde abonnement (404/410 fra
// push-tjenesten) slettes underveis.
export async function sendPushTilBruker(client: PoolClient, userId: string, payload: PushPayload): Promise<number> {
    konfigurer()

    const rader = (
        await client.query<AbonnementRad>(
            `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
            [userId],
        )
    ).rows

    let sendt = 0
    for (const rad of rader) {
        try {
            await webpush.sendNotification(
                { endpoint: rad.endpoint, keys: { p256dh: rad.p256dh, auth: rad.auth } },
                JSON.stringify(payload),
            )
            sendt++
        } catch (e) {
            const statusCode = (e as { statusCode?: number }).statusCode
            if (statusCode === 404 || statusCode === 410) {
                // Abonnementet finnes ikke lenger — rydd det bort.
                await client.query(`DELETE FROM push_subscriptions WHERE id = $1`, [rad.id])
            } else {
                console.error('Push-sending feilet', statusCode, e)
            }
        }
    }
    return sendt
}

export interface KringkastingResultat {
    brukere: number
    enheter: number
}

// Kringkaster et varsel til alle aktive brukere som har skrudd på generelle
// varsler (notif_general) og har minst ett push-abonnement. Returnerer antall
// brukere som faktisk fikk varselet og totalt antall enheter.
export async function sendPushTilAlle(client: PoolClient, payload: PushPayload): Promise<KringkastingResultat> {
    konfigurer()

    const brukere = (
        await client.query<{ id: string }>(
            `SELECT DISTINCT u.id
             FROM users u
             INNER JOIN push_subscriptions ps ON ps.user_id = u.id
             WHERE u.active = true AND u.notif_general = true`,
        )
    ).rows

    let brukereVarslet = 0
    let enheter = 0
    for (const bruker of brukere) {
        const sendt = await sendPushTilBruker(client, bruker.id, payload)
        if (sendt > 0) {
            brukereVarslet++
            enheter += sendt
        }
    }
    console.log(`[send-push-alle] kringkastet til ${brukereVarslet} brukere (${enheter} enheter)`)
    return { brukere: brukereVarslet, enheter }
}
