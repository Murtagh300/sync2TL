import axios from 'axios'
import { fn } from './actions'

/**
 * Liquidity the wallet provides on VeChain DEXes:
 * - BetterSwap V2: LP tokens (an ERC-20 per pool), worth their share of the pool;
 * - BetterSwap V3: position NFTs, their token amounts from the pool's current price;
 * - VeTrade V3: position NFTs, counted (VeTrade's pools aren't in BetterSwap's list).
 */

const betterswap = axios.create({
    baseURL: import.meta.env.BETTERSWAP_API_URL || (import.meta.env.QUASAR_DEV ? '/betterswap-api' : 'https://www.betterswap.io/api'),
    timeout: 20 * 1000
})

const FACTORIES = '0x5970dcbebac33e75eff315c675f1d2654f7bf1f5,0xf9f1722f95d036efbd1352d84e3a3755f8027b39'
export const BETTERSWAP_V3_MANAGER = '0xd943b2acf4b115c233d70fb1b3eaf5134eb2ca61'
export const VETRADE_V3_MANAGER = '0x2fa251f2a433004cb16f51b6af44fa2eb91969b3'

type Amount = { formatted: string, decimals: number, raw: string }
type Token = { address: string, symbol: string, decimals: number, image: string }

export type Pool = {
    poolAddress: string
    version: 'v2' | 'v3'
    feeTier: number
    token0: Token
    token1: Token
    reserve0?: Amount
    reserve1?: Amount
    totalSupply?: Amount
    sqrtPriceX96?: string
    tick?: number
    totalUsdValue: number
    apy: number
    /** VET appears as "" in the list; positions use the DEX's wrapped VET */
    dex?: { wvetAddress?: string }
}

export type Position = {
    key: string
    dex: 'BetterSwap' | 'BetterSwap V3' | 'VeTrade V3'
    pair: string
    token0: Token
    token1: Token
    amount0: number
    amount1: number
    /** USD; null when unknown */
    usd: number | null
    apy: number | null
    /** V3: whether the price is inside the position's range */
    inRange?: boolean
    url: string
}

const balanceOf = fn('balanceOf', [['address', 'owner']], [['uint256', 'balance']])
const tokenOfOwnerByIndex = fn('tokenOfOwnerByIndex', [['address', 'owner'], ['uint256', 'index']], [['uint256', 'tokenId']])
const positions = fn('positions', [['uint256', 'tokenId']], [
    ['uint96', 'nonce'], ['address', 'operator'], ['address', 'token0'], ['address', 'token1'], ['uint24', 'fee'],
    ['int24', 'tickLower'], ['int24', 'tickUpper'], ['uint128', 'liquidity'],
    ['uint256', 'feeGrowthInside0LastX128'], ['uint256', 'feeGrowthInside1LastX128'], ['uint128', 'tokensOwed0'], ['uint128', 'tokensOwed1']
])

let poolsCache: { at: number, pools: Pool[] } | null = null

export async function loadPools(): Promise<Pool[]> {
    if (poolsCache && poolsCache.at > Date.now() - 10 * 60 * 1000) {
        return poolsCache.pools
    }
    const resp = await betterswap.get<Pool[]>('/pools', { params: { version: 'all', factories: FACTORIES } })
    poolsCache = { at: Date.now(), pools: resp.data }
    return resp.data
}

/** dry-run calls in batches; null for a reverted one */
async function call(thor: Connex.Thor, clauses: { to: string, data: string }[]): Promise<(string | null)[]> {
    const out: (string | null)[] = []
    for (let i = 0; i < clauses.length; i += 40) {
        const batch = clauses.slice(i, i + 40)
        const results = await thor.explain(batch.map(c => ({ to: c.to, value: 0, data: c.data }))).execute()
        // a revert stops the batch: what follows it is retried one by one
        for (let j = 0; j < batch.length; j++) {
            const r = results[j]
            if (r && !r.reverted) {
                out.push(r.data)
            } else if (r && r.reverted) {
                out.push(null)
            } else {
                const [single] = await thor.explain([{ to: batch[j]!.to, value: 0, data: batch[j]!.data }]).execute()
                out.push(single && !single.reverted ? single.data : null)
            }
        }
    }
    return out
}

/** a pool token's contract: VET is the DEX's wrapped VET */
const addr = (p: Pool, t: Token) => (t.address || p.dex?.wvetAddress || '').toLowerCase()

/** token amounts of a V3 position at the pool's price (Uniswap V3 math, in floats: for display) */
function v3Amounts(liquidity: number, sqrtPriceX96: string, tickLower: number, tickUpper: number) {
    const sqrtP = Number(BigInt(sqrtPriceX96)) / 2 ** 96
    const sqrtA = Math.sqrt(1.0001 ** tickLower)
    const sqrtB = Math.sqrt(1.0001 ** tickUpper)
    if (sqrtP <= sqrtA) return { a0: liquidity * (sqrtB - sqrtA) / (sqrtA * sqrtB), a1: 0, inRange: false }
    if (sqrtP >= sqrtB) return { a0: 0, a1: liquidity * (sqrtB - sqrtA), inRange: false }
    return { a0: liquidity * (sqrtB - sqrtP) / (sqrtP * sqrtB), a1: liquidity * (sqrtP - sqrtA), inRange: true }
}

export async function findPositions(thor: Connex.Thor, owner: string): Promise<Position[]> {
    const pools = await loadPools()
    const out: Position[] = []

    // V2: LP token balances
    const v2 = pools.filter(p => p.version === 'v2')
    const balances = await call(thor, v2.map(p => ({ to: p.poolAddress, data: balanceOf.encode(owner) })))
    v2.forEach((p, i) => {
        const raw = balances[i]
        if (!raw || BigInt(raw) === 0n || !p.totalSupply || BigInt(p.totalSupply.raw) === 0n) return
        const share = Number(BigInt(raw) * 1_000_000n / BigInt(p.totalSupply.raw)) / 1_000_000
        out.push({
            key: `v2:${p.poolAddress}`,
            dex: 'BetterSwap',
            pair: `${p.token0.symbol}/${p.token1.symbol}`,
            token0: p.token0,
            token1: p.token1,
            amount0: share * Number(p.reserve0?.formatted || 0),
            amount1: share * Number(p.reserve1?.formatted || 0),
            usd: share * (p.totalUsdValue || 0),
            apy: p.apy ?? null,
            url: `https://www.betterswap.io/pools/betterswap/${p.poolAddress}`
        })
    })

    // V3: position NFTs on each manager
    for (const [manager, dex] of [[BETTERSWAP_V3_MANAGER, 'BetterSwap V3'], [VETRADE_V3_MANAGER, 'VeTrade V3']] as const) {
        const [countRaw] = await call(thor, [{ to: manager, data: balanceOf.encode(owner) }])
        const count = countRaw ? Math.min(Number(BigInt(countRaw)), 30) : 0
        if (!count) continue
        const ids = (await call(thor, Array.from({ length: count }, (_, i) => ({ to: manager, data: tokenOfOwnerByIndex.encode(owner, i) }))))
            .filter((x): x is string => !!x).map(x => BigInt(x).toString())
        const details = await call(thor, ids.map(id => ({ to: manager, data: positions.encode(id) })))
        details.forEach((raw, i) => {
            if (!raw) return
            const d = positions.decode(raw)
            if (BigInt(d.liquidity) === 0n) return
            const t0 = String(d.token0).toLowerCase()
            const t1 = String(d.token1).toLowerCase()
            const pool = dex === 'BetterSwap V3'
                ? pools.find(p => p.version === 'v3' && addr(p, p.token0) === t0 && addr(p, p.token1) === t1 && p.feeTier === Number(d.fee))
                : undefined
            const token = (addr: string, fallback?: Token): Token => fallback || { address: addr, symbol: `${addr.slice(0, 6)}…`, decimals: 18, image: '' }
            const position: Position = {
                key: `${dex}:${ids[i]}`,
                dex,
                pair: pool ? `${pool.token0.symbol}/${pool.token1.symbol}` : `#${ids[i]}`,
                token0: token(t0, pool?.token0),
                token1: token(t1, pool?.token1),
                amount0: 0,
                amount1: 0,
                usd: null,
                apy: pool?.apy ?? null,
                url: dex === 'VeTrade V3' ? 'https://vetrade.vet/pools' : `https://www.betterswap.io/pools/betterswap-v3/${pool?.poolAddress || ''}`
            }
            if (pool?.sqrtPriceX96) {
                const { a0, a1, inRange } = v3Amounts(Number(d.liquidity), pool.sqrtPriceX96, Number(d.tickLower), Number(d.tickUpper))
                position.amount0 = a0 / 10 ** pool.token0.decimals
                position.amount1 = a1 / 10 ** pool.token1.decimals
                position.inRange = inRange
            }
            out.push(position)
        })
    }
    return out
}
