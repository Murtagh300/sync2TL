import type { Ctx } from './http.ts'
import { HttpError, json } from './http.ts'
import { TtlCache } from './cache.ts'

/**
 * The gateway: BetterSwap and BlackVeMarket's public data for the wallet, with CORS (they send
 * none), a shared cache and rate limits. Only listed read-only paths pass; nothing with a
 * session or a signature goes through here.
 */

/** a path that passes, how long its answer is kept, and the query parameters it may carry */
type Rule = { pattern: RegExp, ttl: number, stale: number, query?: string[] }

const S = 1000
const M = 60 * S

export const RULES: Record<'betterswap' | 'bvm', Rule[]> = {
    betterswap: [
        { pattern: /^token-prices\/stats$/, ttl: 60 * S, stale: 5 * M, query: ['addresses'] },
        { pattern: /^token-prices\/history$/, ttl: 10 * M, stale: 30 * M, query: ['addresses', 'hours'] },
        { pattern: /^tokens$/, ttl: 60 * M, stale: 6 * 60 * M },
        { pattern: /^pools$/, ttl: 10 * M, stale: 30 * M, query: ['version', 'factories'] }
    ],
    bvm: [
        { pattern: /^collections$/, ttl: 2 * M, stale: 10 * M },
        { pattern: /^collection\/[a-z0-9-]{1,80}$/i, ttl: 60 * S, stale: 5 * M, query: ['limit', 'offset', 'status', 'sort'] },
        { pattern: /^collection\/[a-z0-9-]{1,80}\/(floor-history|stats)$/i, ttl: 30 * M, stale: 2 * 60 * M },
        { pattern: /^collection\/[a-z0-9-]{1,80}\/collection-offers$/i, ttl: 60 * S, stale: 5 * M },
        { pattern: /^profile\/0x[0-9a-f]{40}$/i, ttl: 30 * S, stale: 2 * M, query: ['limit', 'offset', 'status', 'sort', 'collection'] },
        { pattern: /^wallet\/0x[0-9a-f]{40}\/vet-name$/i, ttl: 10 * M, stale: 60 * M },
        { pattern: /^nft\/0x[0-9a-f]{40}\/\d{1,80}$/i, ttl: 30 * S, stale: 2 * M },
        { pattern: /^activity$/, ttl: 30 * S, stale: 2 * M, query: ['limit', 'collection'] },
        { pattern: /^launchpad\/public$/, ttl: 60 * S, stale: 5 * M },
        { pattern: /^rates$/, ttl: 5 * M, stale: 30 * M },
        { pattern: /^delegate\/status$/, ttl: 30 * S, stale: 0, query: ['wallet'] },
        { pattern: /^push\/public-key$/, ttl: 60 * M, stale: 24 * 60 * M }
    ]
}

/** the rule for a path, or null when it doesn't pass */
export function ruleFor(service: keyof typeof RULES, path: string): Rule | null {
    if (path.length > 300 || path.includes('..')) return null
    return RULES[service].find(r => r.pattern.test(path)) || null
}

type Upstream = { status: number, body: string }

const MAX_BODY = 8 * 1024 * 1024
/** what the cache may hold in all, so a flood of different requests can't fill the memory */
const CACHE_BYTES = 64 * 1024 * 1024

async function fetchUpstream(url: string): Promise<Upstream> {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } })
    const type = resp.headers.get('content-type') || ''
    const length = Number(resp.headers.get('content-length') || 0)
    if (length > MAX_BODY) throw new HttpError(502, 'upstream answer too large')
    const body = await resp.text()
    if (body.length > MAX_BODY) throw new HttpError(502, 'upstream answer too large')
    if (resp.status >= 500) throw new HttpError(502, `upstream ${resp.status}`)
    // an HTML error page is not data
    if (resp.ok && !/json/.test(type)) throw new HttpError(502, 'upstream did not answer JSON')
    return { status: resp.status, body }
}

export function createProxy(bases: Record<keyof typeof RULES, string>) {
    const cache = new TtlCache<Upstream>(2000, Date.now, { maxBytes: CACHE_BYTES, sizeOf: v => v.body.length })
    return async function proxy(ctx: Ctx, service: keyof typeof RULES) {
        const path = ctx.params.rest || ''
        const rule = ruleFor(service, path)
        if (!rule) throw new HttpError(404, 'not a gateway path')
        if (ctx.url.search.length > 2000) throw new HttpError(414, 'query too long')
        // only the parameters the wallet sends, once each: every other query is another cache entry
        const query = [...ctx.url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
        const allowed = rule.query || []
        const names = query.map(([k]) => k)
        if (names.some(k => !allowed.includes(k)) || new Set(names).size !== names.length || query.some(([, v]) => v.length > 1500)) {
            throw new HttpError(400, 'query not allowed')
        }
        const qs = query.length ? '?' + new URLSearchParams(query).toString() : ''
        const target = `${bases[service]}/${path}${qs}`
        const { value, cache: state } = await cache.get(`${service}:${path}${qs}`, rule.ttl, rule.stale, async () => {
            const up = await fetchUpstream(target)
            if (up.status >= 400 && up.status !== 404) {
                // not worth keeping; still answer it
                throw Object.assign(new HttpError(up.status, 'upstream refused'), { upstream: up })
            }
            return up
        }).catch((err: Error & { upstream?: Upstream }) => {
            if (err.upstream) return { value: err.upstream, cache: 'miss' as const }
            throw err
        })
        ctx.res.statusCode = value.status
        ctx.res.setHeader('Content-Type', 'application/json; charset=utf-8')
        ctx.res.setHeader('Cache-Control', `public, max-age=${Math.floor(rule.ttl / 1000)}`)
        ctx.res.setHeader('X-Cache', state)
        ctx.res.end(value.body)
    }
}

export function proxyError(ctx: Ctx, err: unknown) {
    const status = err instanceof HttpError ? err.status : 502
    json(ctx.res, status, { error: err instanceof Error ? err.message : 'gateway error' })
}
