import type { App } from 'vue'
import AsyncComputed from 'vue-async-computed'
import { createGtag } from 'vue-gtag'

export function boot(app: App) {
    app.use(AsyncComputed)

    // analytics only when a measurement id is supplied at build time (GA_ID=G-XXXX)
    const gaId = import.meta.env.GA_ID
    if (import.meta.env.QUASAR_PROD && gaId) {
        app.use(createGtag({ tagId: gaId }))
    }
}
