import type { DatabaseSync } from 'node:sqlite'

/**
 * Push subscriptions: a browser's push endpoint (with its keys) and the addresses it wants
 * news about. Addresses are public; nothing here can move funds.
 */

/**
 * outgoing: also a push for transfers out of the addresses and new approvals they give;
 * rounds: a push when a VeBetterDAO round starts; rewards: when a voting reward can be claimed;
 * tokens: when a token is added to VeChain's token registry; validators: the validators to watch
 */
export type Subscription = {
    endpoint: string, keys: { p256dh: string, auth: string }, lang: string,
    outgoing?: boolean, rounds?: boolean, rewards?: boolean, tokens?: boolean, validators?: string[]
}

export const MAX_ADDRESSES = 20
export const MAX_VALIDATORS = 20
/** all subscriptions together: the watcher reads these every 10 seconds */
export const MAX_WATCHED = 50000
export const LANGS = ['en', 'nl', 'de', 'fr', 'zh', 'es', 'it', 'ja', 'ko', 'pt', 'tr', 'vi', 'ru', 'pl', 'id']

/**
 * The push services browsers use. The server only ever posts to these: a subscription can't make
 * it call some other address (inside the host's network, or anyone's server).
 */
const PUSH_HOSTS = [
    /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Opera, Samsung
    /^updates\.push\.services\.mozilla\.com$/, // Firefox
    /^web\.push\.apple\.com$/, // Safari
    /^[a-z0-9-]+\.notify\.windows\.com$/ // Edge on Windows
]

export function isPushService(endpoint: string): boolean {
    try {
        const u = new URL(endpoint)
        return u.protocol === 'https:' && !u.port && !u.username && !u.password && PUSH_HOSTS.some(h => h.test(u.hostname))
    } catch {
        return false
    }
}

/** a subscription from a client, checked; throws with a reason when it isn't valid */
export function validateSubscribe(raw: unknown): { sub: Subscription, addresses: string[] } {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const s = (r.subscription && typeof r.subscription === 'object' ? r.subscription : {}) as Record<string, unknown>
    const keys = (s.keys && typeof s.keys === 'object' ? s.keys : {}) as Record<string, unknown>
    const endpoint = typeof s.endpoint === 'string' ? s.endpoint : ''
    if (!/^https:\/\/[^\s]{8,1000}$/.test(endpoint)) throw new Error('subscription endpoint must be https')
    if (!isPushService(endpoint)) throw new Error('not a browser push service')
    const b64 = /^[A-Za-z0-9_-]{8,200}={0,2}$/
    if (typeof keys.p256dh !== 'string' || !b64.test(keys.p256dh) || typeof keys.auth !== 'string' || !b64.test(keys.auth)) {
        throw new Error('subscription keys missing')
    }
    const list = Array.isArray(r.addresses) ? r.addresses : []
    const addresses = [...new Set(list.filter((a): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)).map(a => a.toLowerCase()))]
    if (!addresses.length) throw new Error('no valid addresses')
    if (addresses.length > MAX_ADDRESSES) throw new Error(`at most ${MAX_ADDRESSES} addresses`)
    const lang = typeof r.lang === 'string' && LANGS.includes(r.lang.slice(0, 2)) ? r.lang.slice(0, 2) : 'en'
    const vlist = Array.isArray(r.validators) ? r.validators : []
    const validators = [...new Set(vlist.filter((a): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)).map(a => a.toLowerCase()))]
    if (validators.length > MAX_VALIDATORS) throw new Error(`at most ${MAX_VALIDATORS} validators`)
    return {
        sub: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, lang, outgoing: r.outgoing === true, rounds: r.rounds === true, rewards: r.rewards === true, tokens: r.tokens === true, validators },
        addresses
    }
}

export function createStore(db: DatabaseSync) {
    const upsert = db.prepare(`INSERT INTO subscriptions (endpoint, keys, addresses, lang, outgoing, rounds, rewards, tokens, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys, addresses = excluded.addresses, lang = excluded.lang, outgoing = excluded.outgoing,
            rounds = excluded.rounds, rewards = excluded.rewards, tokens = excluded.tokens, updated_at = excluded.updated_at`)
    const clearValidators = db.prepare('DELETE FROM push_validators WHERE endpoint = ?')
    const addValidator = db.prepare('INSERT OR IGNORE INTO push_validators (endpoint, validator) VALUES (?, ?)')
    const clearWatched = db.prepare('DELETE FROM watched WHERE endpoint = ?')
    const watch = db.prepare('INSERT OR IGNORE INTO watched (address, endpoint) VALUES (?, ?)')
    const remove = db.prepare('DELETE FROM subscriptions WHERE endpoint = ?')
    const byAddress = db.prepare(`SELECT s.endpoint, s.keys, s.lang, s.addresses, s.outgoing FROM watched w
        JOIN subscriptions s ON s.endpoint = w.endpoint WHERE w.address = ?`)
    const allAddresses = db.prepare('SELECT DISTINCT address FROM watched')
    const outgoingAddresses = db.prepare('SELECT DISTINCT w.address FROM watched w JOIN subscriptions s ON s.endpoint = w.endpoint WHERE s.outgoing = 1')
    const count = db.prepare('SELECT COUNT(*) AS n FROM subscriptions')
    const exists = db.prepare('SELECT 1 AS x FROM subscriptions WHERE endpoint = ?')
    const watchedCount = db.prepare('SELECT COUNT(DISTINCT address) AS n FROM watched')
    const getState = db.prepare('SELECT value FROM state WHERE key = ?')
    const setState = db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')

    return {
        subscribe(sub: Subscription, addresses: string[]) {
            const now = Date.now()
            db.exec('BEGIN')
            try {
                upsert.run(sub.endpoint, JSON.stringify(sub.keys), JSON.stringify(addresses), sub.lang, sub.outgoing ? 1 : 0, sub.rounds ? 1 : 0, sub.rewards ? 1 : 0, sub.tokens ? 1 : 0, now, now)
                clearWatched.run(sub.endpoint)
                for (const a of addresses) watch.run(a, sub.endpoint)
                clearValidators.run(sub.endpoint)
                for (const v of sub.validators || []) addValidator.run(sub.endpoint, v)
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
            return (byAddress.all(address.toLowerCase()) as { endpoint: string, keys: string, lang: string, addresses: string, outgoing: number }[])
                .map(r => ({ endpoint: r.endpoint, keys: JSON.parse(r.keys), lang: r.lang, outgoing: r.outgoing === 1, addresses: JSON.parse(r.addresses) }))
        },
        addresses(): string[] {
            return (allAddresses.all() as { address: string }[]).map(r => r.address)
        },
        /** the addresses some subscription wants outgoing news for */
        outgoingAddresses(): string[] {
            return (outgoingAddresses.all() as { address: string }[]).map(r => r.address)
        },
        has(endpoint: string): boolean {
            return !!exists.get(endpoint)
        },
        count(): number {
            return (count.get() as { n: number }).n
        },
        /** distinct addresses watched by all subscriptions together */
        watchedCount(): number {
            return (watchedCount.get() as { n: number }).n
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
