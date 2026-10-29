/**
 * Every VeChain dApp in one place: VeChain's App Hub (github.com/vechain/app-hub, published at
 * vechain.github.io/app-hub: each app with a category, tags and logo) together with the X2Earn apps
 * of VeBetterDAO's current round (utils/x2earn.ts), joined on the DAO app id where the App Hub has it.
 * Our own apps come first, as Featured.
 */

export const APP_HUB = 'https://vechain.github.io/app-hub/'

export const CATEGORIES = ['defi', 'sustainability', 'collectibles', 'marketplaces', 'games', 'utilities'] as const
export type Category = typeof CATEGORIES[number]

/** BlackVeMarket's own apps and the projects around it, by App Hub id */
export const FEATURED_APPS = ['com.blackvemarket', 'fun.squadvechain', 'fun.squadtc', 'xyz.thevvall', 'green.bubbles']

export type HubEntry = {
    id: string
    name: string
    href: string
    desc: string
    category: string
    tags?: string[]
    isVeWorldSupported?: boolean
    veBetterDaoId?: string
    createAt?: number
}

export type HubApp = {
    id: string
    name: string
    url: string
    desc: string
    icon: string
    category: Category
    tags: string[]
    featured: boolean
    /** an X2Earn app of VeBetterDAO's current round */
    dao: boolean
    /** listed in the last 60 days */
    isNew: boolean
}

export type DaoApp = { id: string, name: string, description: string, logo: string, url: string }

const isCategory = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c)
const safeUrl = (u: string) => (/^https:\/\//i.test(u || '') ? u : '')

/** the App Hub list and the DAO's apps as one list: featured first, then the newest */
export function mergeApps(hub: HubEntry[], dao: DaoApp[], now = Date.now()): HubApp[] {
    const out = new Map<string, HubApp>()
    const daoIds = new Set(dao.map(d => d.id.toLowerCase()))
    for (const e of hub) {
        const url = safeUrl(e.href)
        if (!e.id || !url) continue
        out.set(e.id, {
            id: e.id,
            name: e.name,
            url,
            desc: e.desc || '',
            icon: `${APP_HUB}imgs/${encodeURIComponent(e.id)}.png`,
            category: isCategory(e.category) ? e.category : 'utilities',
            tags: (e.tags || []).map(t => t.toLowerCase()),
            featured: FEATURED_APPS.includes(e.id),
            dao: !!e.veBetterDaoId && daoIds.has(e.veBetterDaoId.toLowerCase()),
            isNew: !!e.createAt && now - e.createAt < 60 * 86400 * 1000
        })
    }
    // the DAO's apps the App Hub doesn't list yet
    const listed = new Set(hub.map(e => (e.veBetterDaoId || '').toLowerCase()).filter(Boolean))
    for (const d of dao) {
        const url = safeUrl(d.url)
        if (listed.has(d.id.toLowerCase()) || !url) continue
        out.set(`dao:${d.id}`, {
            id: `dao:${d.id}`,
            name: d.name,
            url,
            desc: d.description,
            icon: d.logo,
            category: 'sustainability',
            tags: ['vebetterdao'],
            featured: false,
            dao: true,
            isNew: false
        })
    }
    const order = (a: HubApp) => (a.featured ? FEATURED_APPS.indexOf(a.id) : 1000)
    const created = new Map(hub.map(e => [e.id, e.createAt || 0]))
    return [...out.values()].sort((a, b) => order(a) - order(b) || (created.get(b.id) || 0) - (created.get(a.id) || 0))
}

/** what the search and the category chip leave */
export function filterApps(apps: HubApp[], query: string, category: Category | 'featured' | 'dao' | ''): HubApp[] {
    const q = query.trim().toLowerCase()
    return apps.filter(a =>
        (!category || (category === 'featured' ? a.featured : category === 'dao' ? a.dao : a.category === category)) &&
        (!q || a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q) || a.tags.some(t => t.includes(q))))
}

const CACHE = 'bv-apphub'

/** the App Hub's list, kept six hours; the last copy when it can't be reached */
export async function loadHub(): Promise<HubEntry[]> {
    const cached = ((): { at: number, list: HubEntry[] } | null => {
        try {
            return JSON.parse(localStorage.getItem(CACHE) || 'null') as { at: number, list: HubEntry[] } | null
        } catch {
            return null
        }
    })()
    if (cached && Date.now() - cached.at < 6 * 3600 * 1000) return cached.list
    try {
        const r = await fetch(`${APP_HUB}index.json`)
        if (!r.ok) throw new Error(String(r.status))
        const list = await r.json() as HubEntry[]
        try {
            localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), list }))
        } catch { }
        return list
    } catch (err) {
        if (cached) return cached.list
        throw err
    }
}
