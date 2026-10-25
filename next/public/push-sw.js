/* Push messages from BlackVeMarket (offers, sales, price alerts), shown while BlackVault is closed.
   Imported into the generated service worker (quasar.config.ts, importScripts). */
self.addEventListener('push', event => {
    let data = {}
    try {
        data = event.data ? event.data.json() : {}
    } catch (e) {
        data = { body: event.data ? event.data.text() : '' }
    }
    const title = data.title || 'BlackVault'
    event.waitUntil(self.registration.showNotification(title, {
        body: data.body || data.message || '',
        icon: 'icons/icon-192x192.png',
        badge: 'icons/favicon-96x96.png',
        data: { url: data.url || '' }
    }))
})

self.addEventListener('notificationclick', event => {
    event.notification.close()
    // BlackVeMarket links to its own pages: open the wallet's notification center instead
    const target = self.registration.scope + '#/notifications'
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        for (const c of list) {
            if ('focus' in c) {
                c.navigate && c.navigate(target)
                return c.focus()
            }
        }
        return self.clients.openWindow(target)
    }))
})
