import { defineRouter } from '#q-app'
import {
    createMemoryHistory,
    createRouter,
    createWebHashHistory,
    createWebHistory
} from 'vue-router'
import routes from './routes'
import { installStack } from './stack'

export default defineRouter(function () {
    const createHistory = import.meta.env.QUASAR_SERVER
        ? createMemoryHistory
        : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
            ? createWebHistory
            : createWebHashHistory

    const router = createRouter({
        scrollBehavior: () => ({ left: 0, top: 0 }),
        routes,
        history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
    })

    installStack(router)
    return router
})
