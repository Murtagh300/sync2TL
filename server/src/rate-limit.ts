/**
 * Token buckets per client: `perMinute` requests, refilled continuously, so a burst is fine
 * and a steady flood is not. Old buckets are dropped to keep memory flat.
 */
export class RateLimiter {
    private buckets = new Map<string, { tokens: number, at: number }>()
    private perMinute: number
    private now: () => number

    constructor(perMinute: number, now: () => number = Date.now) {
        this.perMinute = perMinute
        this.now = now
    }

    /** whether this client may make a request now; takes one token if so */
    take(key: string, cost = 1): boolean {
        const t = this.now()
        const b = this.buckets.get(key) || { tokens: this.perMinute, at: t }
        b.tokens = Math.min(this.perMinute, b.tokens + (t - b.at) * this.perMinute / 60000)
        b.at = t
        const ok = b.tokens >= cost
        if (ok) b.tokens -= cost
        this.buckets.set(key, b)
        if (this.buckets.size > 50000) this.sweep()
        return ok
    }

    /** drop buckets that are full again: their clients have been quiet a minute */
    sweep() {
        const t = this.now()
        for (const [k, b] of this.buckets) {
            if (t - b.at > 60000) this.buckets.delete(k)
        }
    }
}
