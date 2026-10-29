import { serverUrl } from './endpoints'

/**
 * Web shop checkout through the BlackVault server (server/src/shop.ts): a shop is made here for one
 * of your addresses; its id and key go into the shop's plugin (WooCommerce, or any server that can
 * make an HTTP call). An order opens in BlackVault as a checkout page, and the server sees it paid.
 * The key can only make orders and read their status: it moves no money.
 */

const KEY = 'bv-shops'

export type Shop = { id: string, key: string, name: string, address: string, createdAt: number }

export function myShops(): Shop[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]') as Shop[]
    } catch {
        return []
    }
}

export const shopAvailable = () => serverUrl !== null

export async function createShop(address: string, name: string): Promise<Shop> {
    const r = await fetch(`${serverUrl}/shop`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: address.toLowerCase(), name }) })
    const b = await r.json().catch(() => ({})) as { id?: string, key?: string, error?: string }
    if (!r.ok || !b.id || !b.key) throw new Error(b.error || `shop ${r.status}`)
    const shop = { id: b.id, key: b.key, name: name.trim(), address: address.toLowerCase(), createdAt: Date.now() }
    try {
        localStorage.setItem(KEY, JSON.stringify([shop, ...myShops()]))
    } catch { }
    return shop
}

export function forgetShop(id: string) {
    try {
        localStorage.setItem(KEY, JSON.stringify(myShops().filter(s => s.id !== id)))
    } catch { }
}

/** the server's address as the shop's plugin needs it */
export function apiBase(): string {
    return serverUrl ? new URL(serverUrl, window.location.href).href.replace(/\/$/, '') : ''
}

export type Checkout = {
    shopName: string
    address: string
    amount: string
    symbol: string
    fiat: number
    currency: string
    status: 'pending' | 'paid' | 'expired'
    txId: string | null
    returnUrl: string
    expiresAt: number
}

export async function readCheckout(token: string): Promise<Checkout> {
    const r = await fetch(`${serverUrl}/checkout/${encodeURIComponent(token)}`, { cache: 'no-store' })
    if (!r.ok) throw new Error(`checkout ${r.status}`)
    return r.json() as Promise<Checkout>
}
