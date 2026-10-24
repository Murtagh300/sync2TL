import Vue from 'vue'
import AsyncComputed from 'vue-async-computed'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Fragment = require('vue-fragment')
import VueGtag from 'vue-gtag'

export function boot() {
    Vue.use(AsyncComputed)
    Vue.use(Fragment.Plugin)
    // analytics only when a measurement id is supplied at build time (GA_ID=G-XXXX)
    const gaId = process.env.GA_ID
    Vue.use(VueGtag, {
        config: { id: gaId || 'disabled' },
        enabled: !!(process.env.PROD && gaId),
        disableScriptLoad: !(process.env.PROD && gaId)
    })
}
