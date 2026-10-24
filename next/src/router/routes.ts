import type { RouteRecordRaw } from 'vue-router'

// the app's pages are ported in phases 2-4; until then only the toolchain check
const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: () => import('pages/ToolchainCheck.vue')
    },
    {
        path: '/:catchAll(.*)*',
        redirect: '/'
    }
]

export default routes
