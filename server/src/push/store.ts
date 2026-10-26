import type { DatabaseSync } from 'node:sqlite'

/**
 * Push subscriptions: a browser's push endpoint (with its keys) and the addresses it wants
 * news about. Addresses are public; nothing here can move funds.
 */

export type Subscription = { endpoint: string, keys: { p256dh: string, auth: string }, lang: string }

export const MAX_ADDRESSES = 20
export const LANGS = ['en', 'nl', 'de', 'fr', 'zh']

/** a subscription from a client, checked; throws with a reason when it isn't valid */
export function validateSubscribe(raw: unknown): { sub: Subscription, addresses: string[] } {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const s = (r.subscription && typeof r.subscription === 'object' ? r.subscription : {}) as Record<string, unknown>
    const keys = (s.keys && typeof s.keys === 'object' ? s.keys : {}) as Record<string, unknown>
    const endpoint = typeof s.endpoint === 'string' ? s.endpoint : ''
    if (!/^https:\/\/[^\s]{8,1000}$/.test(endpoint)) throw new Error('subscription endpoint must be https')
    const b64 = /^[A-Za-z0-9_-]{8,200}={0,2}$/
    if (typeof keys.p256dh !== 'string' || !b64.test(keys.p256dh) || typeof keys.auth !== 'string' || !b64.test(keys.auth)) {
        throw new Error('subscription keys missing')
    }
    const list = Array.isArray(r.addresses) ? r.addresses : []
    const addresses = [...new Set(list.filter((a): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)).map(a => a.toLowerCase()))]
    if (!addresses.length) throw new Error('no valid addresses')
    if (addresses.length > MAX_ADDRESSES) throw new Error(`at most ${MAX_ADDRESSES} addresses`)
    const lang = typeof r.lang === 'string' && LANGS.includes(r.lang.slice(0, 2)) ? r.lang.slice(0, 2) : 'en'
    return { sub: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, lang }, addresses }
}

export function createStore(db: DatabaseSync) {
    const upsert = db.prepare(`INSERT INTO subscriptions (endpoint, keys, addresses, lang, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys, addresses = excluded.addresses, lang = excluded.lang, updated_at = excluded.updated_at`)
    const clearWatched = db.prepare('DELETE FROM watched WHERE endpoint = ?')
    const watch = db.prepare('INSERT OR IGNORE INTO watched (address, endpoint) VALUES (?, ?)')
    const remove = db.prepare('DELETE FROM subscriptions WHERE endpoint = ?')
    const byAddress = db.prepare(`SELECT s.endpoint, s.keys, s.lang, s.addresses FROM watched w
        JOIN subscriptions s ON s.endpoint = w.endpoint WHERE w.address = ?`)
    const allAddresses = db.prepare('SELECT DISTINCT address FROM watched')
    const count = db.prepare('SELECT COUNT(*) AS n FROM subscriptions')
    const getState = db.prepare('SELECT value FROM state WHERE key = ?')
    const setState = db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')

    return {
        subscribe(sub: Subscription, addresses: string[]) {
            const now = Date.now()
            db.exec('BEGIN')
            try {
                upsert.run(sub.endpoint, JSON.stringify(sub.keys), JSON.stringify(addresses), sub.lang, now, now)
                clearWatched.run(sub.endpoint)
                for (const a of addresses) watch.run(a, sub.endpoint)
                db.exec('COMMIT')
            } catch (err) {
                db.exec('ROLLBACK')
                throw err
            }
        },
        unsubscribe(endpoint: string) {
            remove.run(endpoint)
        },
        /** the subscriptions watching an address, with every address each one watches */
        forAddress(address: string): (Subscription & { addresses: string[] })[] {
            return (byAddress.all(address.toLowerCase()) as { endpoint: string, keys: string, lang: string, addresses: string }[])
                .map(r => ({ endpoint: r.endpoint, keys: JSON.parse(r.keys), lang: r.lang, addresses: JSON.parse(r.addresses) }))
        },
        addresses(): string[] {
            return (allAddresses.all() as { address: string }[]).map(r => r.address)
        },
        count(): number {
            return (count.get() as { n: number }).n
        },
        lastBlock(): number | null {
            const r = getState.get('push:lastBlock') as { value: string } | undefined
            return r ? Number(r.value) : null
        },
        setLastBlock(n: number) {
            setState.run('push:lastBlock', String(n))
        }
    }
}

export type Store = ReturnType<typeof createStore>
