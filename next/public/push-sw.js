/* Push messages, shown while BlackVault is closed: from BlackVeMarket (offers, sales, price alerts)
   or from the BlackVault server (incoming transfers). Imported into the generated service worker
   (quasar.config.ts, importScripts). */
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
        // one notification per transaction, also when it arrives twice
        tag: typeof data.tag === 'string' ? data.tag : undefined,
        data: { url: data.url || '' }
    }))
})

self.addEventListener('notificationclick', event => {
    event.notification.close()
    // only the wallet's own pages (#/…, a plain query allowed): BlackVeMarket links to its site, which
    // opens the notification center
    const url = (event.notification.data && event.notification.data.url) || ''
    const target = self.registration.scope + (/^#\/[a-z0-9/-]*(\?[a-z0-9=&%._-]*)?$/i.test(url) ? url : '#/notifications')
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
