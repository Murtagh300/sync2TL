import { defineBoot } from '#q-app'
import type { ComponentPublicInstance } from 'vue'
import * as State from './state'
import * as Plugins from './plugins'
import * as Modals from './modals'
import { genesises } from 'src/consts'
import { stack } from 'src/router/stack'
import { installErrorReports } from 'src/utils/error-reports'
import { startRemoteConfig } from 'src/utils/remote-config'

declare module 'vue' {
    interface ComponentCustomProperties {
        /** navigate back or go to home(/) if the stack is empty */
        $backOrHome(): void
        /** returns the display name of network identified by gid */
        $netDisplayName(gid: string): string
        /** it wraps window.addEventListener binding to vue component's life-cycle */
        $onWindowEvent(event: keyof WindowEventMap, listener: EventListenerOrEventListenerObject): void
    }
}

// window listeners registered by $onWindowEvent, removed when their component unmounts
const windowListeners = new WeakMap<ComponentPublicInstance, Array<() => void>>()

export default defineBoot(({ app, router }) => {
    installErrorReports(app, () => String(router.currentRoute.value.name || ''))
    startRemoteConfig()
    State.boot(app)
    Plugins.boot(app)
    Modals.boot(app)

    app.mixin({
        beforeUnmount(this: ComponentPublicInstance) {
            const removers = windowListeners.get(this)
            if (removers) {
                windowListeners.delete(this)
                removers.forEach(r => r())
            }
        }
    })

    const props = app.config.globalProperties
    props.$backOrHome = function (this: ComponentPublicInstance) {
        stack.canGoBack
            ? this.$router.back()
            : void this.$router.replace('/')
    }
    props.$netDisplayName = function (this: ComponentPublicInstance, gid: string) {
        switch (gid) {
            case genesises.main.id: return this.$t('common.mainnet').toString()
            case genesises.test.id: return this.$t('common.testnet').toString()
            default: {
                const name = this.$t('common.private').toString()
                const suffix = gid ? `-${gid.slice(-6)}` : ''
                return name + suffix
            }
        }
    }
    props.$onWindowEvent = function (this: ComponentPublicInstance, event, listener) {
        window.addEventListener(event, listener)
        const removers = windowListeners.get(this) || []
        removers.push(() => window.removeEventListener(event, listener))
        windowListeners.set(this, removers)
    }
})
