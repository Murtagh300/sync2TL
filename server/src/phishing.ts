/**
 * Known phishing sites, for the wallet to warn before a site may sign: MetaMask's list
 * (eth-phishing-detect, about 100,000 domains, many aimed at every chain) plus our own for
 * VeChain. Loaded at start and every 6 hours; a failed load keeps the last good list.
 * The wallet sends just a host name and gets back whether it is listed.
 */

export const METAMASK_LIST = 'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json'

/** reported VeChain scams that aren't on MetaMask's list yet */
export const OWN_LIST = [
    'vechain.co.com',
    'vebettertrading.top'
]

export type Lists = { blocked: Set<string>, allowed: Set<string> }

/** a host and each parent domain it belongs to: a.b.example.com, b.example.com, example.com */
export function domainsOf(host: string): string[] {
    const parts = host.toLowerCase().replace(/\.$/, '').split('.')
    const out: string[] = []
    for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join('.'))
    return out
}

/** valid host names only: letters, digits, dashes and dots, no port */
export const HOST = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z0-9-]{2,63}$/i

export function isListed(lists: Lists, host: string): boolean {
    const domains = domainsOf(host)
    // an allowed domain (or its parent) wins: MetaMask lists hosts on shared platforms
    if (domains.some(d => lists.allowed.has(d))) return false
    return domains.some(d => lists.blocked.has(d))
}

export function parseLists(raw: unknown): Lists {
    const r = (raw && typeof raw === 'object' ? raw : {}) as { blacklist?: unknown, whitelist?: unknown }
    const strings = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').map(s => s.toLowerCase()) : []
    const blocked = strings(r.blacklist)
    if (blocked.length < 1000) throw new Error(`phishing list too short (${blocked.length})`)
    return { blocked: new Set([...blocked, ...OWN_LIST]), allowed: new Set(strings(r.whitelist)) }
}

export function createPhishing(opts: { url?: string, fetch?: typeof fetch, every?: number } = {}) {
    const get = opts.fetch || fetch
    let lists: Lists = { blocked: new Set(OWN_LIST), allowed: new Set() }
    let loadedAt = 0

    async function load() {
        try {
            const resp = await get(opts.url || METAMASK_LIST, { signal: AbortSignal.timeout(30000) })
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            lists = parseLists(await resp.json())
            loadedAt = Date.now()
            console.log(`[phishing] ${lists.blocked.size} domains`)
        } catch (err) {
            console.warn('[phishing] load failed, keeping the last list:', (err as Error).message)
        }
    }

    return {
        load,
        start() {
            void load()
            setInterval(() => void load(), opts.every || 6 * 3600 * 1000).unref()
        },
        check: (host: string) => isListed(lists, host),
        get size() { return lists.blocked.size },
        get loadedAt() { return loadedAt }
    }
}
