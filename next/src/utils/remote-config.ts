import { reactive } from 'vue'
import { createClient } from './net'
import { serverUrl } from './endpoints'

/**
 * What the BlackVault server says about the wallet (server/src/flags.ts, server/src/health.ts):
 * - features that are paused (remote config can only switch a feature off, never change
 *   where funds go);
 * - a notice for everyone, and the lowest app version that is still fine to use;
 * - which services are down, so the app can say so instead of looking broken.
 * Without a server everything is on and nothing shows.
 */

export const FEATURES = ['walletconnect', 'swap', 'payout', 'dust', 'consolidate', 'stargate', 'vebetter', 'launchpad', 'push'] as const
export type Feature = typeof FEATURES[number]

export type Flags = {
    version: number
    features: Partial<Record<Feature, boolean>>
    notice: { level: 'info' | 'warning', text: Record<string, string> } | null
    minVersion: string
}

export type Health = { ok: boolean, at: string, checks: { name: string, ok: boolean }[] }

const KEY = 'bv-remote-config'

function cached(): Flags | null {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Flags | null
        return v && typeof v === 'object' && v.features ? v : null
    } catch {
        return null
    }
}

export const remote = reactive<{ flags: Flags | null, health: Health | null }>({ flags: cached(), health: null })

/** is this feature on? (on unless the server switched it off) */
export function featureOn(f: Feature): boolean {
    return remote.flags?.features?.[f] !== false
}

/** the feature a route belongs to, for the router guard */
export const routeFeature: Record<string, Feature> = {
    walletconnect: 'walletconnect',
    swap: 'swap',
    payout: 'payout',
    dust: 'dust',
    consolidate: 'consolidate',
    stargate: 'stargate',
    vebetter: 'vebetter',
    vote: 'vebetter',
    leaderboard: 'vebetter',
    validators: 'stargate',
    impact: 'vebetter',
    proposals: 'vebetter',
    launchpad: 'launchpad',
    launch: 'launchpad'
}

/** -1, 0 or 1, for x.y.z versions (anything after a '-' is ignored) */
export function compareVersions(a: string, b: string): number {
    const parts = (v: string) => v.split('-')[0]!.split('.').map(n => parseInt(n, 10) || 0)
    const x = parts(a)
    const y = parts(b)
    for (let i = 0; i < 3; i++) {
        const d = (x[i] || 0) - (y[i] || 0)
        if (d) return d > 0 ? 1 : -1
    }
    return 0
}

/** the notice in this language, falling back to English */
export function noticeText(flags: Flags | null, lang: string): string {
    const text = flags?.notice?.text
    if (!text) return ''
    return text[lang] || text[lang.slice(0, 2)] || text.en || Object.values(text)[0] || ''
}

/** the services the server finds down, by name (BlackVeMarket, BetterSwap, …); all nodes down counts as 'VeChain' */
export function downServices(h: Health | null): string[] {
    if (!h) return []
    const nodes = h.checks.filter(c => c.name.startsWith('node '))
    const down = h.checks.filter(c => !c.ok && !c.name.startsWith('node ')).map(c => c.name)
    if (nodes.length && nodes.every(c => !c.ok)) down.unshift('VeChain')
    return down
}

// one quick try: this is background information, and the health answer is a 503 when degraded
const http = serverUrl === null ? null : createClient({ baseURL: serverUrl, timeout: 8000, retries: 0, validateStatus: s => s === 200 || s === 503 })

async function refresh() {
    if (!http || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
    await Promise.all([
        http.get<Flags>('/config').then(r => {
            if (r.status !== 200 || !r.data || typeof r.data !== 'object') return
            remote.flags = r.data
            try {
                localStorage.setItem(KEY, JSON.stringify(r.data))
            } catch { }
        }).catch(() => { }),
        http.get<Health>('/health').then(r => {
            if (r.data && Array.isArray(r.data.checks)) remote.health = r.data
        }).catch(() => { })
    ])
}

let started = false
/** read the config now and every five minutes, and again when the app comes back to the front */
export function startRemoteConfig() {
    if (started || !http) return
    started = true
    void refresh()
    setInterval(() => void refresh(), 5 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void refresh()
    })
}
