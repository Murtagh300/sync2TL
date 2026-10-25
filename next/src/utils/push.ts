import axios from 'axios'

/**
 * Push notifications through BlackVeMarket: offers on your NFTs, sales and price alerts,
 * even when BlackVault is closed. BlackVeMarket sends them to a signed-in wallet, so the
 * wallet signs in first (a certificate, as when connecting on blackvemarket.com), then
 * subscribes this device. Works in the installed app (PWA), where the service worker runs.
 */

const baseURL = import.meta.env.BVM_API_URL || (import.meta.env.QUASAR_DEV ? '/bvm-api' : 'https://blackvemarket.com/api')
// the session is a cookie: it has to travel with these requests
const http = axios.create({ baseURL, timeout: 20 * 1000, withCredentials: true })

export function pushSupported() {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

/** the address BlackVeMarket has a session for, or '' */
export async function bvmSession(): Promise<string> {
    try {
        const r = await http.get<{ wallet?: string }>('/auth/session', { headers: { 'cache-control': 'no-store' } })
        return (r.data.wallet || '').toLowerCase()
    } catch {
        return ''
    }
}

/** the certificate BlackVeMarket asks for when connecting */
export function signInMessage(): Connex.Vendor.CertMessage {
    return {
        purpose: 'identification',
        payload: { type: 'text', content: 'The following dApp would like to see your public address: https://blackvemarket.com' }
    }
}

export async function bvmSignIn(certificate: unknown) {
    await http.post('/auth/session', { certificate })
}

async function deviceSubscription(): Promise<PushSubscription> {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
        return existing
    }
    const { data } = await http.get<{ publicKey: string }>('/push/public-key')
    const raw = atob(`${data.publicKey}${'='.repeat((4 - data.publicKey.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/'))
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) })
}

/** turn push on for the signed-in wallet on this device */
export async function enablePush() {
    if ((await Notification.requestPermission()) !== 'granted') {
        throw new Error('blocked')
    }
    const subscription = await deviceSubscription()
    await http.post('/push/subscribe', { subscription: subscription.toJSON() })
}

export async function disablePush() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
        await http.delete('/push/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => { })
        await sub.unsubscribe()
    }
}

export async function pushEnabled(): Promise<boolean> {
    if (!pushSupported()) {
        return false
    }
    try {
        const reg = await navigator.serviceWorker.getRegistration()
        return !!(reg && await reg.pushManager.getSubscription())
    } catch {
        return false
    }
}
