/**
 * The sign relay: how a dApp reaches the wallet without WalletConnect. It speaks the protocol
 * of VeChain's Sync2 relay (TOS), so the wallet's sign page works with either:
 *
 *   POST /relay/<id>            the dApp posts its request (id: sha-256 or blake2b-256 of the body)
 *   GET  /relay/<id>?wait=1     the wallet reads it (X-Data-Origin: the dApp's origin)
 *   POST /relay/<id>.accepted   the wallet says it has the request
 *   POST /relay/<id>.resp       the wallet answers: { payload } or { error }
 *   GET  /relay/<id>.resp?wait=1
 *
 * A GET waits up to 20 seconds for the value and returns an empty 200 when there is none yet.
 * Each key is written once (nobody can swap a request or an answer), lives 10 minutes, and
 * only in memory. The wallet checks the request against its id, so the relay can't change it.
 */

export const KEY = /^[0-9a-f]{64}(\.accepted|\.resp)?$/
const TTL = 10 * 60 * 1000
const WAIT = 20 * 1000
export const MAX_BODY = 64 * 1024
const MAX_ENTRIES = 5000

type Entry = { body: string, origin: string, at: number }

export function createRelay(now: () => number = Date.now) {
    const entries = new Map<string, Entry>()
    const waiters = new Map<string, Set<(e: Entry) => void>>()
    let bytes = 0

    const sweep = () => {
        const t = now()
        for (const [k, e] of entries) {
            if (t - e.at < TTL) break // in insertion order: the rest are newer
            entries.delete(k)
            bytes -= e.body.length
        }
    }

    return {
        /** stores a value, unless the key was written before or the relay is full */
        put(key: string, body: string, origin: string): 'ok' | 'exists' | 'full' {
            sweep()
            if (entries.has(key)) return 'exists'
            if (entries.size >= MAX_ENTRIES || bytes + body.length > MAX_ENTRIES * 4096) return 'full'
            const e = { body, origin, at: now() }
            entries.set(key, e)
            bytes += body.length
            const ws = waiters.get(key)
            if (ws) {
                waiters.delete(key)
                for (const w of ws) w(e)
            }
            return 'ok'
        },
        /** the value, waiting for it up to `wait` ms; null when it doesn't come */
        get(key: string, wait = 0, signal?: AbortSignal): Promise<Entry | null> {
            sweep()
            const e = entries.get(key)
            if (e || wait <= 0) return Promise.resolve(e || null)
            return new Promise(resolve => {
                const set = waiters.get(key) || new Set()
                waiters.set(key, set)
                const done = (v: Entry | null) => {
                    clearTimeout(timer)
                    set.delete(done)
                    if (!set.size && waiters.get(key) === set) waiters.delete(key)
                    resolve(v)
                }
                const timer = setTimeout(() => done(null), Math.min(wait, WAIT))
                signal?.addEventListener('abort', () => done(null))
                set.add(done)
            })
        },
        size: () => entries.size
    }
}
