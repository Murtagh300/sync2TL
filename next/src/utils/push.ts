import { createClient } from './net'
import { bvmDirectUrl, serverUrl } from './endpoints'
import { prefs } from './prefs'

/**
 * Push notifications through BlackVeMarket: offers on your NFTs, sales and price alerts,
 * even when BlackVault is closed. BlackVeMarket sends them to a signed-in wallet, so the
 * wallet signs in first (a certificate, as when connecting on blackvemarket.com), then
 * subscribes this device. Works in the installed app (PWA), where the service worker runs.
 */

// the session is a cookie: it has to travel with these requests, to BlackVeMarket itself
const http = createClient({ baseURL: bvmDirectUrl, withCredentials: true })

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

/** an offer this wallet made, as BlackVeMarket lists it (read loosely: fields may vary) */
export type MadeOffer = { name: string, collection: string, image: string, amount: string, contract: string, tokenId: string }

/** the offers an address made; BlackVeMarket answers a signed-in wallet only (401 otherwise) */
export async function madeOffers(address: string): Promise<MadeOffer[]> {
    const r = await http.get<{ made?: Record<string, unknown>[] }>(`/profile/${address.toLowerCase()}/offers`, { headers: { 'cache-control': 'no-store' } })
    const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
    return (r.data.made || []).map(o => {
        const nft = (o.nft || {}) as Record<string, unknown>
        const contract = str(o.contract || o.nftContract || nft.contract)
        const tokenId = str(o.tokenId || nft.tokenId)
        const amount = [str(o.displayAmount || o.price || o.amount), str(o.currency || o.paySymbol)].filter(Boolean).join(' ')
        return {
            name: str(o.name || nft.name) || (contract ? `${contract.slice(0, 6)}… #${tokenId}` : '—'),
            collection: str(o.collection || o.collectionName || nft.collection),
            image: /^https:/.test(str(o.image || nft.image)) ? str(o.image || nft.image) : '',
            amount,
            contract,
            tokenId
        }
    })
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
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64url(data.publicKey) })
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

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
    const raw = atob(`${text}${'='.repeat((4 - text.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array) {
    if (!a || a.byteLength !== b.byteLength) return false
    const x = new Uint8Array(a)
    return x.every((v, i) => v === b[i])
}

/*
 * Incoming transfers through the BlackVault server (server/src/push): the device tells it which
 * addresses to watch, nothing else. No sign-in, no keys; the server reads the chain itself.
 * A device has one push subscription, tied to one sender's key: this and BlackVeMarket's push
 * can't both be on at the same time on one device.
 */
const own = serverUrl === null ? null : createClient({ baseURL: serverUrl })

/** does this build have a BlackVault server with push? */
export async function ownPushAvailable(): Promise<boolean> {
    if (!own || !pushSupported()) return false
    try {
        await own.get('/push/key')
        return true
    } catch {
        return false
    }
}

export type OwnPushState = 'off' | 'on' | 'other'

/** off, on (subscribed with the server's key) or other (this device has BlackVeMarket's push) */
export async function ownPushState(): Promise<OwnPushState> {
    if (!own || !pushSupported()) return 'off'
    try {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = reg && await reg.pushManager.getSubscription()
        if (!sub) return 'off'
        const { data } = await own.get<{ publicKey: string }>('/push/key')
        return sameKey(sub.options.applicationServerKey, fromBase64url(data.publicKey)) ? 'on' : 'other'
    } catch {
        return 'off'
    }
}

/**
 * what else the server pushes besides incoming transfers: outgoing ones and approvals given, a new
 * VeBetterDAO round, a voting reward to claim, a new token in the registry, and changes at the
 * validators the user's StarGate NFTs are with
 */
export type PushOptions = { outgoing?: boolean, rounds?: boolean, rewards?: boolean, tokens?: boolean, validators?: string[] }

const VALIDATORS_KEY = 'bv-push-validators'

/** the validators last handed over (the StarGate page refreshes them) */
export function pushValidators(): string[] {
    try {
        const v = JSON.parse(localStorage.getItem(VALIDATORS_KEY) || '[]') as string[]
        return Array.isArray(v) ? v.filter(a => /^0x[0-9a-f]{40}$/.test(a)).slice(0, 20) : []
    } catch {
        return []
    }
}

export function setPushValidators(list: string[]): boolean {
    const next = [...new Set(list.map(a => a.toLowerCase()))].filter(a => /^0x[0-9a-f]{40}$/.test(a) && !/^0x0{40}$/.test(a)).sort().slice(0, 20)
    const changed = JSON.stringify(next) !== JSON.stringify(pushValidators())
    try {
        localStorage.setItem(VALIDATORS_KEY, JSON.stringify(next))
    } catch { }
    return changed
}

/** the options as the settings have them now */
export function pushOptions(): PushOptions {
    return { outgoing: prefs.pushOutgoing, rounds: prefs.pushRounds, rewards: prefs.pushRewards, tokens: prefs.pushTokens, validators: prefs.pushValidators ? pushValidators() : [] }
}

/** watch these addresses for incoming transfers on this device (again: replaces the list), and more (PushOptions) */
export async function enableOwnPush(addresses: string[], lang: string, opts: PushOptions = pushOptions()) {
    if (!own) throw new Error('unavailable')
    if ((await Notification.requestPermission()) !== 'granted') {
        throw new Error('blocked')
    }
    const reg = await navigator.serviceWorker.ready
    const { data } = await own.get<{ publicKey: string }>('/push/key')
    const key = fromBase64url(data.publicKey)
    let sub = await reg.pushManager.getSubscription()
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
        throw new Error('other')
    }
    sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    const json = sub.toJSON()
    await own.post('/push/subscribe', {
        subscription: { endpoint: json.endpoint, keys: json.keys },
        addresses: addresses.map(a => a.toLowerCase()).slice(0, 20),
        lang: lang.slice(0, 2),
        outgoing: !!opts.outgoing,
        rounds: !!opts.rounds,
        rewards: !!opts.rewards,
        tokens: !!opts.tokens,
        validators: opts.validators || []
    })
}

export async function disableOwnPush() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
        await own?.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => { })
        await sub.unsubscribe()
    }
}

/** a reminder the BlackVault server pushes on a schedule (a recurring buy); the text is the device's */
export type OwnReminder = { id: string, next: number, every: 'day' | 'week' | 'month', title: string, body: string, url: string }

/** replace this device's reminders on the server; nothing when its push isn't on */
export async function syncOwnReminders(reminders: OwnReminder[]) {
    if (!own || (await ownPushState()) !== 'on') return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await own.post('/push/reminders', { endpoint: sub.endpoint, reminders: reminders.slice(0, 20) })
}

/** a token price alert the BlackVault server checks (in dollars) and pushes once per crossing */
export type OwnPriceAlert = { id: string, token: string, kind: 'below' | 'above', usd: number, title: string, url: string }

/** replace this device's price alerts on the server; nothing when its push isn't on */
export async function syncOwnPriceAlerts(alerts: OwnPriceAlert[]) {
    if (!own || (await ownPushState()) !== 'on') return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await own.post('/push/price-alerts', { endpoint: sub.endpoint, alerts: alerts.slice(0, 20) })
}
