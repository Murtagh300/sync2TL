import { createApp, type App, type Component } from 'vue'
import { Dialog, type QDialogOptions } from 'quasar'
import ModalLoading from 'components/ModalLoading.vue'

/**
 * Options for $dialog. Besides Quasar's own options, a custom `component`
 * receives every other key as a prop (as with Quasar 1, where the old code
 * passed them inline).
 */
export type DialogOptions = Omit<QDialogOptions, 'component' | 'componentProps'> & {
    component?: Component
    [prop: string]: unknown
}

declare module 'vue' {
    interface ComponentCustomProperties {
        $dialog<T>(options: DialogOptions): Promise<T>

        /**
         * protected the async task with a loading mask
         * @param task the async task
         * @returns the result of the task
         */
        $loading<T>(task: () => Promise<T>): Promise<T>
    }
}

// $authenticate, $signTx, $signCert and $qrcode open dialogs that are ported
// with the pages in phase 4 and are registered there.

export function dialog<T>(options: DialogOptions) {
    const { component, ...rest } = options
    const opts: QDialogOptions = component
        ? { component, componentProps: rest }
        : rest as QDialogOptions
    return new Promise<T>((resolve, reject) => {
        Dialog.create(opts)
            .onOk(resolve)
            .onCancel((err?: unknown) => reject(err || new Error('cancelled')))
    })
}

export const loading = (() => {
    let counter = 0
    let mask: { app: App, node: HTMLElement } | undefined
    return async <T>(task: () => Promise<T>) => {
        try {
            if (counter++ === 0) {
                // mount at once (0 delay) to block mouse/touch events
                const node = document.createElement('div')
                document.body.appendChild(node)
                const app = createApp(ModalLoading)
                app.mount(node)
                mask = { app, node }
            }
            return await task()
        } finally {
            if (--counter === 0 && mask) {
                mask.app.unmount()
                mask.node.remove()
                mask = undefined
            }
        }
    }
})()

export function boot(app: App) {
    app.config.globalProperties.$dialog = dialog
    app.config.globalProperties.$loading = loading
}
