import type { RouteRecordRaw } from 'vue-router'
import Main from 'layouts/Main'
import ToolchainCheck from 'pages/ToolchainCheck.vue'
import StackDemo from 'pages/StackDemo.vue'

// the app's pages are ported in phase 4; until then the checks of phases 1-3
const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: Main,
        children: [{
            path: '',
            name: 'index',
            component: ToolchainCheck
        }, {
            path: 'stack-demo/:level',
            name: 'stack-demo',
            component: StackDemo
        }]
    },
    // Always leave this as last one
    {
        path: '/:catchAll(.*)*',
        redirect: '/'
    }
]

export default routes
