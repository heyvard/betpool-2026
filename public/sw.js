/* eslint-disable */
// Service worker for web push-varsler. Registreres fra usePushVarsler-hooken.
// Holdes bevisst minimal — ingen offline-caching, kun push.

self.addEventListener('push', (event) => {
    let data = {}
    try {
        data = event.data ? event.data.json() : {}
    } catch (e) {
        data = {}
    }
    const title = data.title || 'VM Betpool'
    const options = {
        body: data.body || '',
        icon: '/favicon-192x192.png',
        badge: '/favicon-192x192.png',
        data: { url: data.url || '/my-bets' },
    }
    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = (event.notification.data && event.notification.data.url) || '/my-bets'
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.navigate(url)
                    return client.focus()
                }
            }
            return self.clients.openWindow(url)
        }),
    )
})
