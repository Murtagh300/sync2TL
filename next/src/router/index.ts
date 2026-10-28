import { defineRouter } from '#q-app'
import {
    createMemoryHistory,
    createRouter,
    createWebHashHistory,
    createWebHistory
} from 'vue-router'
import routes from './routes'
import { installStack } from './stack'
import { featureOn, routeFeature } from 'src/utils/remote-config'
import { profilePathToHash } from 'src/utils/profile'

export default defineRouter(function () {
    const createHistory = import.meta.env.QUASAR_SERVER
        ? createMemoryHistory
        : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
            ? createWebHistory
            : createWebHashHistory

    // wallet.blackvemarket.com/u/name.vet: the page is the app; its route goes in the hash
    if (typeof window !== 'undefined') {
        const hash = profilePathToHash(window.location.pathname)
        if (hash) window.history.replaceState(null, '', `/#${hash}`)
    }

    const router = createRouter({
        scrollBehavior: () => ({ left: 0, top: 0 }),
        routes,
        history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
    })

    installStack(router)
    // a feature the server paused (utils/remote-config.ts) can't be opened, also not from a link
    router.beforeEach(to => {
        const f = routeFeature[String(to.name || '')]
        return f && !featureOn(f) ? { name: 'more', query: { paused: f }, replace: true } : true
    })
    return router
})
