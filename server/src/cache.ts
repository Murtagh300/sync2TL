/**
 * An in-memory cache with a size cap and per-entry lifetime, that also merges identical
 * requests in flight: a hundred wallets asking for the same prices make one upstream call.
 * Past its lifetime an entry may still be served (stale) while a fresh one is fetched.
 */

type Entry<T> = { value: T, freshUntil: number, staleUntil: number }

export class TtlCache<T> {
    private entries = new Map<string, Entry<T>>()
    private inflight = new Map<string, Promise<T>>()
    private max: number
    private now: () => number

    constructor(max = 500, now: () => number = Date.now) {
        this.max = max
        this.now = now
    }

    get size() {
        return this.entries.size
    }

    peek(key: string): Entry<T> | undefined {
        return this.entries.get(key)
    }

    set(key: string, value: T, ttlMs: number, staleMs = 0) {
        // least recently set goes first
        this.entries.delete(key)
        if (this.entries.size >= this.max) {
            const oldest = this.entries.keys().next().value
            if (oldest !== undefined) this.entries.delete(oldest)
        }
        const t = this.now()
        this.entries.set(key, { value, freshUntil: t + ttlMs, staleUntil: t + ttlMs + staleMs })
    }

    /**
     * the cached value when fresh; when stale, the old value at once and a refresh behind it;
     * otherwise one shared fetch
     */
    async get(key: string, ttlMs: number, staleMs: number, load: () => Promise<T>): Promise<{ value: T, cache: 'hit' | 'stale' | 'miss' }> {
        const t = this.now()
        const e = this.entries.get(key)
        if (e && t < e.freshUntil) {
            return { value: e.value, cache: 'hit' }
        }
        const refresh = () => {
            let p = this.inflight.get(key)
            if (!p) {
                p = load().then(v => {
                    this.set(key, v, ttlMs, staleMs)
                    return v
                }).finally(() => this.inflight.delete(key))
                this.inflight.set(key, p)
            }
            return p
        }
        if (e && t < e.staleUntil) {
            refresh().catch(() => { /* the stale value stays until it expires */ })
            return { value: e.value, cache: 'stale' }
        }
        return { value: await refresh(), cache: 'miss' }
    }
}
