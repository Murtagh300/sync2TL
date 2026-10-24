import { createApp, type App, type Component, type ComponentPublicInstance } from 'vue'
import { Dialog, type QDialogOptions } from 'quasar'
import ModalLoading from 'components/ModalLoading.vue'
import AuthenticationDialog from 'pages/AuthenticationDialog'
import QRCodeDialog from 'pages/QRCodeDialog.vue'
import { CertDialog, TxDialog } from 'pages/Sign'
import { BioPass } from 'src/utils/bio-pass'

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

        /**
         * pop up the authentication dialog to ask user entering password
         * @returns user master key
         */
        $authenticate(): Promise<Buffer>

        /**
         * sign tx
         * @param gid desired genesis id of user wallet
         * @param req request content
         */
        $signTx(gid: string, req: M.TxRequest): Promise<M.TxResponse>

        /**
         * sign cert
         * @param gid desired genesis id of user wallet
         * @param req request content
         */
        $signCert(gid: string, req: M.CertRequest): Promise<M.CertResponse>

        /**
         * qr code dialog
         * @param req
         */
        $qrcode(req: M.QRRequest): void
    }
}

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
    const props = app.config.globalProperties
    props.$dialog = dialog
    props.$loading = loading
    props.$authenticate = async function (this: ComponentPublicInstance) {
        try {
            const bioPass = await BioPass.open()
            if (bioPass && await this.$svc.config.getBioPassOn()) {
                return Buffer.from(await bioPass.recall(this.$t('bioAuth.title').toString(), this.$t('common.cancel').toString()), 'hex')
            }
        } catch (err) {
            if ((err as { code?: number }).code === -108 /* BIOMETRIC_DISMISSED */) {
                throw err
            }
            console.warn(err)
        }
        return dialog<Buffer>({ component: AuthenticationDialog })
    }
    props.$signTx = (gid, req) => dialog({ component: TxDialog, gid, req })
    props.$signCert = (gid, req) => dialog({ component: CertDialog, gid, req })
    props.$qrcode = req => { void dialog({ component: QRCodeDialog, req }).catch(() => { }) }
}
