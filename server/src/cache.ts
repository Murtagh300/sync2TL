/**
 * An in-memory cache with a size cap and per-entry lifetime, that also merges identical
 * requests in flight: a hundred wallets asking for the same prices make one upstream call.
 * Past its lifetime an entry may still be served (stale) while a fresh one is fetched.
 */

type Entry<T> = { value: T, freshUntil: number, staleUntil: number, bytes: number }

export class TtlCache<T> {
    private entries = new Map<string, Entry<T>>()
    private inflight = new Map<string, Promise<T>>()
    private max: number
    private now: () => number
    private maxBytes: number
    private sizeOf: (v: T) => number
    private bytes = 0

    /** `max` entries, and optionally `maxBytes` in all as measured by `sizeOf` */
    constructor(max = 500, now: () => number = Date.now, limits: { maxBytes?: number, sizeOf?: (v: T) => number } = {}) {
        this.max = max
        this.now = now
        this.maxBytes = limits.maxBytes ?? Infinity
        this.sizeOf = limits.sizeOf ?? (() => 0)
    }

    get totalBytes() {
        return this.bytes
    }

    private drop(key: string) {
        const e = this.entries.get(key)
        if (e) {
            this.bytes -= e.bytes
            this.entries.delete(key)
        }
    }

    get size() {
        return this.entries.size
    }

    peek(key: string): Entry<T> | undefined {
        return this.entries.get(key)
    }

    set(key: string, value: T, ttlMs: number, staleMs = 0) {
        // least recently set goes first
        this.drop(key)
        const bytes = this.sizeOf(value)
        // one answer bigger than the whole budget is not kept at all
        if (bytes > this.maxBytes) return
        while (this.entries.size >= this.max || (this.entries.size && this.bytes + bytes > this.maxBytes)) {
            const oldest = this.entries.keys().next().value
            if (oldest === undefined) break
            this.drop(oldest)
        }
        const t = this.now()
        this.entries.set(key, { value, freshUntil: t + ttlMs, staleUntil: t + ttlMs + staleMs, bytes })
        this.bytes += bytes
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
