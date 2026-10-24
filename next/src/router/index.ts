import { defineRouter } from '#q-app'
import {
    createMemoryHistory,
    createRouter,
    createWebHashHistory,
    createWebHistory
} from 'vue-router'
import routes from './routes'

export default defineRouter(function () {
    const createHistory = import.meta.env.QUASAR_SERVER
        ? createMemoryHistory
        : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
            ? createWebHistory
            : createWebHashHistory

    return createRouter({
        routes,
        history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
    })
})
