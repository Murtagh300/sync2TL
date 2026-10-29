import { abi } from 'thor-devkit'
import { abis } from 'src/consts'
import type { Service } from 'boot/services'

const balanceOf = new abi.Function(abis.balanceOf)

/**
 * tokens every mainnet address shows, held or not, right after VET and VTHO, each with a way to buy
 * it: SQUAD, and VeBetterDAO's B3TR and VOT3 (VOT3 comes from converting B3TR, not from a swap)
 */
export const FEATURED: { symbol: string, address: string }[] = [
    { symbol: 'SQUAD', address: '0xb27a1fb87935b85cdaa2e16468247278c74c5ec7' },
    { symbol: 'B3TR', address: '0x5ef79995fe8a89e0812330e4378eb2660cede699' },
    { symbol: 'VOT3', address: '0x76ca782b59c74d088c7d2cce2f211bc00836c602' }
]

export function isFeatured(t: { address: string }): boolean {
    const a = (t.address || '').toLowerCase()
    return FEATURED.some(f => f.address === a)
}

/** where "buy" goes for a featured token: a swap from VET, or (VOT3) VeBetterDAO's convert */
export function buyRoute(symbol: string, walletId: string | number, index: string | number): { name: string, query?: Record<string, string> } {
    if (symbol === 'VOT3') return { name: 'vebetter' }
    return { name: 'swap', query: { wid: String(walletId), i: String(index), from: 'VET', to: symbol } }
}

// detected symbols per network and address, so pages don't re-query on every visit
const cache = new Map<string, { at: number, symbols: string[] }>()
const TTL = 5 * 60 * 1000
const BATCH = 40

/**
 * the registry tokens (besides VET/VTHO) the address has a balance of.
 * Uses dry-run clauses, one node request per batch of tokens.
 */
export async function detectHeldTokens(thor: Connex.Thor, address: string, specs: M.TokenSpec[]): Promise<string[]> {
    const candidates = specs.filter(s => !s.permanent && s.address)
    const key = `${thor.genesis.id}:${address.toLowerCase()}`
    const hit = cache.get(key)
    if (hit && hit.at + TTL > Date.now()) {
        return hit.symbols
    }

    const data = balanceOf.encode(address)
    const held: string[] = []
    for (let start = 0; start < candidates.length;) {
        const batch = candidates.slice(start, start + BATCH)
        const outputs = await thor.explain(batch.map(s => ({ to: s.address, value: 0, data }))).execute()
        // a reverted clause ends the dry run: continue right after it
        let done = 0
        for (const [i, o] of outputs.entries()) {
            done = i + 1
            if (o.reverted) {
                break
            }
            try {
                if (o.data && o.data !== '0x' && BigInt(o.data) > 0n) {
                    held.push(batch[i]!.symbol)
                }
            } catch {
                // not a uint256: not a VIP-180 token
            }
        }
        start += Math.max(done, 1)
    }
    cache.set(key, { at: Date.now(), symbols: held })
    return held
}

/**
 * the tokens to show for an address: VET and VTHO, the ones switched on in the
 * token settings, and the ones it holds (found automatically)
 */
export type TokenPrefs = { pinned: string[], hidden: string[] }

export async function visibleTokens(svc: Service, gid: string, address: string, opts: { withHidden?: boolean } = {}): Promise<M.TokenSpec[]> {
    const prefs = await svc.config.getJSON<TokenPrefs>('token-prefs', { pinned: [], hidden: [] })
    const list = await allVisibleTokens(svc, gid, address)
    const shown = opts.withHidden ? list : list.filter(t => t.permanent || isFeatured(t) || !prefs.hidden.includes(t.symbol))
    // pinned first, in pin order; the rest as they were
    const pinned = prefs.pinned.map(s => shown.find(t => t.symbol === s)).filter((t): t is M.TokenSpec => !!t)
    const rest = shown.filter(t => !prefs.pinned.includes(t.symbol))
    // VET and VTHO, the featured ones, then the user's pins and the rest
    const featured = FEATURED.map(f => rest.find(t => t.address.toLowerCase() === f.address)).filter((t): t is M.TokenSpec => !!t)
    const base = rest.filter(t => t.permanent)
    return [...base, ...featured, ...pinned.filter(t => !t.permanent && !isFeatured(t)), ...rest.filter(t => !t.permanent && !isFeatured(t))]
}

async function allVisibleTokens(svc: Service, gid: string, address: string): Promise<M.TokenSpec[]> {
    const [all, active] = await Promise.all([svc.config.token.all(), svc.config.token.activeSymbols()])
    const tokens = all.filter(t => t.gid === gid)
    let held: string[] = []
    if (address) {
        try {
            held = await detectHeldTokens(svc.bc(gid).thor, address, tokens)
        } catch (err) {
            console.warn('token detection:', err)
        }
    }
    return tokens.filter(t => t.permanent || isFeatured(t) || active.includes(t.symbol) || held.includes(t.symbol))
}
