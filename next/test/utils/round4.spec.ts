import { beforeAll, describe, expect, it, vi } from 'vitest'
import { filterApps, FEATURED_APPS, mergeApps, type HubEntry } from 'src/utils/apphub'
import { siteLabel, tokenCategory, tokenLinks } from 'src/utils/token-meta'
import { cleanSymbol, liveOnly } from 'src/utils/custom-tokens'
import { knownHolder, rememberHolder } from 'src/utils/squad'
import { buyRoute, FEATURED, isFeatured } from 'src/utils/tokens'

beforeAll(() => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) })
})

const SHA = '0x5db3c8a942333f6468176a870db36eef120a34dc'
const SQUAD = '0xb27a1fb87935b85cdaa2e16468247278c74c5ec7'

describe('app hub', () => {
    const now = Date.UTC(2026, 9, 29)
    const hub: HubEntry[] = [
        { id: 'io.old', name: 'Old Tool', href: 'https://old.example', desc: 'A tool', category: 'utilities', createAt: now - 400 * 86400 * 1000 },
        { id: 'com.blackvemarket', name: 'BlackVeMarket', href: 'https://blackvemarket.com', desc: 'NFT market', category: 'marketplaces', tags: ['NFT'], createAt: 1 },
        { id: 'app.earn', name: 'Earn', href: 'https://earn.example', desc: 'Recycle', category: 'sustainability', veBetterDaoId: '0xAB', createAt: now - 10 * 86400 * 1000 },
        { id: 'bad.link', name: 'Bad', href: 'javascript:alert(1)', desc: '', category: 'defi' },
        { id: 'odd.cat', name: 'Odd', href: 'https://odd.example', desc: '', category: 'weird' }
    ]
    const dao = [
        { id: '0xab', name: 'Earn', description: '', logo: '', url: 'https://earn.example' },
        { id: '0xcd', name: 'Only DAO', description: 'Not in the hub', logo: 'https://x/logo.png', url: 'https://dao.example' }
    ]

    it('ours first, then the newest; only https; DAO apps joined or added', () => {
        const apps = mergeApps(hub, dao, now)
        expect(apps[0]!.id).toBe('com.blackvemarket')
        expect(apps[0]!.featured).toBe(true)
        expect(apps.find(a => a.id === 'bad.link')).toBeUndefined()
        expect(apps.find(a => a.id === 'odd.cat')!.category).toBe('utilities')
        const earn = apps.find(a => a.id === 'app.earn')!
        expect(earn.dao).toBe(true)
        expect(earn.isNew).toBe(true)
        expect(apps.find(a => a.id === 'dao:0xcd')).toMatchObject({ dao: true, category: 'sustainability', icon: 'https://x/logo.png' })
        expect(apps.filter(a => a.name === 'Earn')).toHaveLength(1)
        expect(FEATURED_APPS).toContain('fun.squadvechain')
    })

    it('filters by category, featured, DAO and words', () => {
        const apps = mergeApps(hub, dao, now)
        expect(filterApps(apps, '', 'featured').map(a => a.id)).toEqual(['com.blackvemarket'])
        expect(filterApps(apps, '', 'dao')).toHaveLength(2)
        expect(filterApps(apps, 'nft', '').map(a => a.id)).toEqual(['com.blackvemarket'])
        expect(filterApps(apps, 'recycle', 'sustainability').map(a => a.id)).toEqual(['app.earn'])
    })
})

describe('token categories and sites', () => {
    it('known tokens, then words in the description', () => {
        expect(tokenCategory({ address: SQUAD })).toBe('meme')
        expect(tokenCategory({ address: '0x5ef79995fe8a89e0812330e4378eb2660cede699' })).toBe('vebetter')
        expect(tokenCategory({ address: '0x1', name: 'Global Dollar', desc: 'A USD stablecoin' })).toBe('stable')
        expect(tokenCategory({ address: '0x2', name: 'Plair', desc: 'decentralized gaming ecosystem' })).toBe('gaming')
        expect(tokenCategory({ address: '0x3', name: 'X', desc: 'a swap and lending protocol' })).toBe('defi')
        expect(tokenCategory({ address: '0x4', name: 'Y' })).toBe('other')
        expect(tokenCategory({ address: '0x5', name: 'Y', custom: true })).toBe('community')
    })

    it('SHA goes to Safe Haven\'s own page; only https links', () => {
        expect(tokenLinks({ address: SHA })[0]).toEqual({ kind: 'website', url: 'https://safehaven.io/sha/' })
        expect(siteLabel(SHA)).toBe('Safe Haven')
        expect(tokenLinks({ address: '0x9', website: 'http://plain.example', links: { twitter: 'https://x.com/a', telegram: 'javascript:x' } }))
            .toEqual([{ kind: 'twitter', url: 'https://x.com/a' }])
    })
})

describe('tokens outside the registry', () => {
    it('cleans symbols and keeps only new tokens with a pool', () => {
        expect(cleanSymbol('S<Q>U A D!')).toBe('SQUAD')
        expect(cleanSymbol('$VET.x-1')).toBe('$VET.x-1')
        const base = { name: 'N', decimals: 18, description: '', image: 'https://img/x.png', website: 'https://site.example', twitter: 'https://x.com/n', telegram: null, discord: 'http://insecure', hasPool: true }
        const list = liveOnly([
            { ...base, address: '0x' + 'a'.repeat(40), symbol: 'NEW' },
            { ...base, address: SQUAD, symbol: 'SQUAD' },
            { ...base, address: '0x' + 'b'.repeat(40), symbol: 'NOPOOL', hasPool: false },
            { ...base, address: 'nope', symbol: 'BAD' }
        ], new Set([SQUAD]))
        expect(list).toHaveLength(1)
        expect(list[0]).toMatchObject({ symbol: 'NEW', iconSrc: 'https://img/x.png', website: 'https://site.example', links: { twitter: 'https://x.com/n' } })
    })
})

describe('SQUAD', () => {
    it('featured on every address, with a way to buy', () => {
        expect(FEATURED.map(f => f.symbol)).toEqual(['SQUAD', 'B3TR', 'VOT3'])
        expect(isFeatured({ address: SQUAD.toUpperCase().replace('0X', '0x') })).toBe(true)
        expect(buyRoute('SQUAD', 3, 0)).toEqual({ name: 'swap', query: { wid: '3', i: '0', from: 'VET', to: 'SQUAD' } })
        expect(buyRoute('VOT3', 3, 0)).toEqual({ name: 'vebetter' })
    })

    it('remembers who holds it for a while', () => {
        const a = '0x' + 'c'.repeat(40)
        expect(knownHolder(a, 1000)).toBeUndefined()
        rememberHolder(a, true, 1000)
        expect(knownHolder(a.toUpperCase().replace('0X', '0x'), 2000)).toBe(true)
        expect(knownHolder(a, 1000 + 7 * 3600 * 1000)).toBeUndefined()
    })
})
