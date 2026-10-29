import { abi } from 'thor-devkit'
import type { Service } from 'boot/services'
import { createClient } from './net'
import { betterswapUrl } from './endpoints'

/**
 * Tokens outside VeChain's token registry: one the user adds by its contract address (name, symbol
 * and decimals read from the contract), and the ones that just went live on BetterSwap: a pool of
 * their own but not in the registry yet. Token Forge coins (vaiyanscrypto.org) land there when they
 * graduate, before their registry listing. None of these is checked by anyone: the wallet says so.
 */

export type CustomToken = { name: string, symbol: string, decimals: number, address: string, icon: string, iconSrc?: string, desc?: string, website?: string, links?: Record<string, string> }

const view = (name: string, type: string) => new abi.Function({
    type: 'function', name, constant: true, payable: false, stateMutability: 'view', inputs: [], outputs: [{ type, name: 'v' }]
})
const meta = { name: view('name', 'string'), symbol: view('symbol', 'string'), decimals: view('decimals', 'uint8') }

export class TokenError extends Error {
    constructor(public code: 'address' | 'not-token' | 'symbol-taken' | 'listed') {
        super(code)
    }
}

/** a symbol people can read: letters, digits and a few signs, at most 16 */
export function cleanSymbol(s: string): string {
    return s.replace(/[^\p{L}\p{N}._$-]/gu, '').slice(0, 16)
}

/** name, symbol and decimals from the contract; throws TokenError('not-token') when it has none */
export async function readToken(thor: Connex.Thor, address: string): Promise<CustomToken> {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new TokenError('address')
    const a = address.toLowerCase()
    const out = await thor.explain([meta.name, meta.symbol, meta.decimals].map(f => ({ to: a, value: 0, data: f.encode() }))).execute()
    try {
        const name = String(meta.name.decode(out[0]!.data).v).slice(0, 60)
        const symbol = cleanSymbol(String(meta.symbol.decode(out[1]!.data).v))
        const decimals = Number(meta.decimals.decode(out[2]!.data).v)
        if (out.some(o => o.reverted) || !symbol || !(decimals >= 0 && decimals <= 36)) throw new Error('bad')
        return { name: name || symbol, symbol, decimals, address: a, icon: '' }
    } catch {
        throw new TokenError('not-token')
    }
}

export async function customTokens(svc: Service): Promise<CustomToken[]> {
    return svc.config.getJSON<CustomToken[]>('custom-tokens', [])
}

/** adds a token (and switches it on); symbols are how the wallet tells tokens apart, so one can't be taken twice */
export async function addCustomToken(svc: Service, t: CustomToken): Promise<void> {
    const all = await svc.config.token.all()
    const a = t.address.toLowerCase()
    const same = all.find(x => x.address.toLowerCase() === a)
    if (same && !same.custom) throw new TokenError('listed')
    if (all.some(x => x.symbol.toLowerCase() === t.symbol.toLowerCase() && x.address.toLowerCase() !== a)) throw new TokenError('symbol-taken')
    const list = (await customTokens(svc)).filter(x => x.address !== a)
    await svc.config.setJSON('custom-tokens', [...list, { ...t, address: a }])
    const active = await svc.config.token.activeSymbols()
    await svc.config.token.saveActiveSymbols([...active, t.symbol])
}

export async function removeCustomToken(svc: Service, address: string): Promise<void> {
    const a = address.toLowerCase()
    await svc.config.setJSON('custom-tokens', (await customTokens(svc)).filter(x => x.address !== a))
}

type BetterSwapToken = { address: string, name: string, symbol: string, decimals: number, description: string, image: string, website: string | null, twitter: string | null, telegram: string | null, discord: string | null, hasPool: boolean }

const betterswap = createClient({ baseURL: betterswapUrl, timeout: 15 * 1000 })

/** BetterSwap tokens with a pool that the registry (and the user's list) doesn't have yet */
export function liveOnly(list: BetterSwapToken[], known: Set<string>): CustomToken[] {
    const https = (u: string | null | undefined) => (u && /^https:\/\//i.test(u) ? u : undefined)
    return list
        .filter(t => t.hasPool && /^0x[0-9a-fA-F]{40}$/.test(t.address || '') && !known.has(t.address.toLowerCase()) && cleanSymbol(t.symbol || ''))
        .map(t => {
            const links: Record<string, string> = {}
            for (const k of ['twitter', 'telegram', 'discord'] as const) {
                const u = https(t[k])
                if (u) links[k] = u
            }
            return {
                name: String(t.name || t.symbol).slice(0, 60),
                symbol: cleanSymbol(t.symbol),
                decimals: Number(t.decimals) || 18,
                address: t.address.toLowerCase(),
                icon: '',
                iconSrc: https(t.image),
                desc: String(t.description || '').slice(0, 500),
                website: https(t.website),
                links
            }
        })
}

export async function liveTokens(svc: Service): Promise<CustomToken[]> {
    const [resp, all] = await Promise.all([betterswap.get<BetterSwapToken[]>('/tokens'), svc.config.token.all()])
    return liveOnly(resp.data, new Set(all.map(t => t.address.toLowerCase())))
}
