// Klientside-hjelpere for web push. Bruker kun nettleser-API-er — aldri
// importert på serveren.

export function pushStøttes(): boolean {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    )
}

// VAPID-nøkkelen er base64url-kodet; PushManager vil ha en Uint8Array.
function base64TilUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const base64Trygg = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64Trygg)
    const ut = new Uint8Array(new ArrayBuffer(raw.length))
    for (let i = 0; i < raw.length; i++) {
        ut[i] = raw.charCodeAt(i)
    }
    return ut
}

async function registrerServiceWorker(): Promise<ServiceWorkerRegistration> {
    const eksisterende = await navigator.serviceWorker.getRegistration()
    if (eksisterende) {
        return eksisterende
    }
    return navigator.serviceWorker.register('/sw.js')
}

export async function hentAbonnement(): Promise<PushSubscription | null> {
    if (!pushStøttes()) {
        return null
    }
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) {
        return null
    }
    return reg.pushManager.getSubscription()
}

// Ber om varselstillatelse og oppretter et push-abonnement. Må kalles fra en
// brukerhandling (klikk) — ellers avviser nettleseren tillatelsesspørsmålet.
export async function abonner(): Promise<PushSubscription> {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
        throw new Error('Push er ikke satt opp ennå')
    }

    const tillatelse = await Notification.requestPermission()
    if (tillatelse !== 'granted') {
        throw new Error('Du må tillate varsler')
    }

    const reg = await registrerServiceWorker()
    await navigator.serviceWorker.ready

    const eksisterende = await reg.pushManager.getSubscription()
    if (eksisterende) {
        return eksisterende
    }
    return reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64TilUint8Array(vapidKey),
    })
}
