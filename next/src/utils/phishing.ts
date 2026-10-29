/**
 * Is the site that asks to sign a phishing site? Two checks:
 * - the BlackVault server's list (MetaMask's list plus ours, server/src/phishing.ts);
 * - here, without a server: a site that copies a VeChain name ("vebeterdao.org", one letter off)
 *   or uses one in its address while it isn't that project's site ("vebetterdao-claim.com").
 * Only the host name goes to the server.
 */
import type { RiskLabel } from './risk'
import { serverUrl } from './endpoints'

/** the projects' own sites; their subdomains count too */
export const OFFICIAL = [
    'vechain.org', 'vechain.com', 'vechain.energy', 'vechainstats.com', 'vebetterdao.org', 'veworld.net', 'veworld.com',
    'vet.domains', 'betterswap.io', 'vetrade.vet', 'vexchange.io', 'blackvemarket.com', 'vechainthor.org'
]

/** names scammers borrow; a site with one in its address that isn't official is suspect */
const BRANDS = ['vechain', 'vebetter', 'veworld', 'vethor', 'b3tr', 'betterswap', 'blackvault', 'blackvemarket']

const lower = (h: string) => h.toLowerCase().replace(/\.$/, '')

export function isOfficial(host: string, own: string[] = []): boolean {
    const h = lower(host)
    return [...OFFICIAL, ...own].some(d => h === d || h.endsWith('.' + d))
}

/** the name part of a domain: "vebetterdao" for governance.vebetterdao.org */
const nameOf = (domain: string) => {
    const parts = lower(domain).split('.')
    return parts.length >= 2 ? parts[parts.length - 2]! : parts[0]!
}

/** edit distance, stopping early above max */
export function distance(a: string, b: string, max = 2): number {
    if (Math.abs(a.length - b.length) > max) return max + 1
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const cur = [i]
        let best = i
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
            best = Math.min(best, cur[j]!)
        }
        if (best > max) return max + 1
        prev = cur
    }
    return prev[b.length]!
}

/** what the address alone says; null for an official or ordinary site */
export function lookalikeLabel(host: string, own: string[] = []): RiskLabel | null {
    const h = lower(host)
    if (!h || isOfficial(h, own) || /^(localhost|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(h)) return null
    const name = nameOf(h.replace(/:\d+$/, ''))
    for (const d of OFFICIAL) {
        const real = nameOf(d)
        // short names ("vet") are too close to too much
        if (real.length >= 6 && name !== real && distance(name, real) <= 2) {
            return { level: 'danger', key: 'site_lookalike', params: { site: d } }
        }
    }
    const brand = BRANDS.find(b => h.includes(b))
    if (brand) return { level: 'warn', key: 'site_brand', params: { name: brand } }
    return null
}

const cache = new Map<string, Promise<boolean>>()

/** on the server's list? false when there is no server or it can't be asked */
export function isListed(host: string): Promise<boolean> {
    const h = lower(host).replace(/:\d+$/, '')
    if (serverUrl === null || !h || isOfficial(h)) return Promise.resolve(false)
    let p = cache.get(h)
    if (!p) {
        p = fetch(`${serverUrl}/phishing?host=${encodeURIComponent(h)}`)
            .then(r => r.ok ? r.json() as Promise<{ listed?: boolean }> : { listed: false })
            .then(b => b.listed === true)
            .catch(() => false)
        cache.set(h, p)
    }
    return p
}

/** both checks for a site: the labels to show, the worst first */
export async function siteLabels(origin: string | undefined): Promise<RiskLabel[]> {
    let host: string
    try {
        host = origin ? new URL(origin).host : ''
    } catch {
        return []
    }
    if (!host) return []
    const own = typeof window !== 'undefined' ? [window.location.host] : []
    if (await isListed(host)) return [{ level: 'danger', key: 'site_listed', params: { site: host } }]
    const l = lookalikeLabel(host, own)
    return l ? [l] : []
}
