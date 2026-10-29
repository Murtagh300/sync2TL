/**
 * What a token is and where it lives on the web: a category (from a list of known tokens, else from
 * words in its registry description), its website and social links (registry or BetterSwap), and a
 * few projects whose site is better than what the registry says (SHA: Safe Haven's own page).
 */

export const TOKEN_CATEGORIES = ['vechain', 'vebetter', 'stable', 'defi', 'gaming', 'nft', 'meme', 'rwa', 'community', 'other'] as const
export type TokenCategory = typeof TOKEN_CATEGORIES[number]

/** known tokens by contract (lowercase) */
const KNOWN: Record<string, TokenCategory> = {
    '': 'vechain',
    '0x0000000000000000000000000000456e65726779': 'vechain',
    // VVET and wrapped VET
    '0x45429a2255e7248e57fce99e7239aed3f84b7a53': 'vechain',
    '0xf9b02b47694fd635a413f16dc7b38af06cc16fe5': 'vechain',
    // B3TR, VOT3, veB3TR
    '0x5ef79995fe8a89e0812330e4378eb2660cede699': 'vebetter',
    '0x76ca782b59c74d088c7d2cce2f211bc00836c602': 'vebetter',
    '0x420dfe6b7bc605ce61e9839c8c0e745870a6cde0': 'vebetter',
    // SQUAD
    '0xb27a1fb87935b85cdaa2e16468247278c74c5ec7': 'meme',
    // SHA (Safe Haven)
    '0x5db3c8a942333f6468176a870db36eef120a34dc': 'rwa'
}

/** by words in the name and description, the first that fits */
const WORDS: [TokenCategory, RegExp][] = [
    ['stable', /\bstable ?coin|\bUSD[A-Z]?\b|\bEUR[A-Z]?\b|pegged/i],
    ['vebetter', /vebetter|x2earn|b3tr/i],
    ['gaming', /\bgam(e|es|ing)\b|play[- ]to[- ]earn|metaverse/i],
    ['nft', /\bNFTs?\b|collectible/i],
    ['meme', /\bmeme|community[- ]driven|\bdog\b|\bcat\b|frog/i],
    ['defi', /\bdefi\b|\bdex\b|swap|lending|yield|liquidity|staking|exchange/i],
    ['rwa', /real[- ]world|supply chain|carbon|traceab|enterprise|identity|insurance|health/i]
]

export function tokenCategory(t: { address: string, name?: string, desc?: string, custom?: boolean }): TokenCategory {
    const known = KNOWN[(t.address || '').toLowerCase()]
    if (known) return known
    const text = `${t.name || ''} ${t.desc || ''}`
    for (const [c, re] of WORDS) if (re.test(text)) return c
    return t.custom ? 'community' : 'other'
}

export type TokenLink = { kind: 'website' | 'twitter' | 'telegram' | 'discord' | 'medium' | 'github' | 'whitepaper', url: string }

/** a project's own site where the registry has none, or a better one */
const SITES: Record<string, { url: string, label?: string }> = {
    '0x5db3c8a942333f6468176a870db36eef120a34dc': { url: 'https://safehaven.io/sha/', label: 'Safe Haven' },
    '0xb27a1fb87935b85cdaa2e16468247278c74c5ec7': { url: 'https://squadvechain.fun/' }
}

const https = (u?: string | null) => (u && /^https:\/\/[^\s]+$/i.test(u) ? u : '')

/** the website first, then the socials; only https links */
export function tokenLinks(t: { address: string, website?: string, links?: Record<string, string> }): TokenLink[] {
    const out: TokenLink[] = []
    const site = SITES[(t.address || '').toLowerCase()]?.url || https(t.website)
    if (site) out.push({ kind: 'website', url: site })
    for (const kind of ['twitter', 'telegram', 'discord', 'medium', 'github'] as const) {
        const u = https(t.links?.[kind])
        if (u) out.push({ kind, url: u })
    }
    return out
}

/** the name to put on the website button ("Safe Haven"), when there is one */
export function siteLabel(address: string): string {
    return SITES[(address || '').toLowerCase()]?.label || ''
}
