import { abi } from 'thor-devkit'
import { abis } from 'src/consts'
import type { Service } from 'boot/services'

const balanceOf = new abi.Function(abis.balanceOf)

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
export async function visibleTokens(svc: Service, gid: string, address: string): Promise<M.TokenSpec[]> {
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
    return tokens.filter(t => t.permanent || active.includes(t.symbol) || held.includes(t.symbol))
}
