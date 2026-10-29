import { serverUrl } from './endpoints'

/**
 * A till behind an NFC sticker (or a printed QR code) at the counter, through the BlackVault server
 * (server/src/till.ts): the sticker holds a link with the till's id, the till puts each sale there,
 * and a tap opens what is to be paid. Any phone opens such a link by itself, iPhones too; writing
 * the sticker from the wallet needs Web NFC (Chrome on Android), or any NFC app.
 */

const KEY = 'bv-tills'

type Till = { id: string, secret: string, address: string }

function load(): Till[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]') as Till[]
    } catch {
        return []
    }
}

export const tapAvailable = () => serverUrl !== null

/** this device's till for an address, if it made one */
export function tillOf(address: string): Till | null {
    return load().find(t => t.address === address.toLowerCase()) || null
}

async function call<T>(path: string, body?: unknown): Promise<T> {
    const r = await fetch(`${serverUrl}${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const b = await r.json().catch(() => ({})) as T & { error?: string }
    if (!r.ok) throw new Error(b.error || `till ${r.status}`)
    return b
}

/** a till for an address (made once per device; the same sticker keeps working) */
export async function ensureTill(address: string): Promise<Till> {
    const have = tillOf(address)
    if (have) return have
    const { id, secret } = await call<{ id: string, secret: string }>('/till', { address: address.toLowerCase() })
    const t = { id, secret, address: address.toLowerCase() }
    try {
        localStorage.setItem(KEY, JSON.stringify([...load(), t]))
    } catch { }
    return t
}

/** put up the open sale on this address's till, or take it down; quiet when it has none */
export async function showSale(address: string, sale: { amount: string, symbol: string } | null) {
    const t = tillOf(address)
    if (!t || !tapAvailable()) return
    await call(`/till/${t.id}`, { secret: t.secret, amount: sale?.amount || '', symbol: sale?.symbol || '' }).catch(err => console.warn('till:', err))
}

export type TapInfo = { address: string, sale: { amount: string, symbol: string, at: number } | null }

export function readTap(id: string): Promise<TapInfo> {
    return call<TapInfo>(`/till/${encodeURIComponent(id)}`)
}

/** the link on the sticker */
export function tapLink(id: string, base = window.location.origin + window.location.pathname) {
    return `${base}#/tap/${id}`
}

export const canWriteNfc = () => typeof window !== 'undefined' && 'NDEFReader' in window

/** writes the link onto a sticker held to the phone (Chrome on Android) */
export async function writeNfc(url: string) {
    const Reader = (window as unknown as { NDEFReader: new () => { write(m: unknown): Promise<void> } }).NDEFReader
    await new Reader().write({ records: [{ recordType: 'url', data: url }] })
}
