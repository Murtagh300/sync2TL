import { fn, fns } from './actions'
import type { Pool } from './liquidity'

/**
 * Adding to and taking out of a BetterSwap V2 pool, through its router (a Uniswap V2 router, read
 * from BetterSwap's pool list and checked on chain: its factory and WETH are the pool's). VET goes in
 * and comes out as VET: the router wraps it.
 *
 * Adding puts both tokens in at the pool's ratio; taking out burns LP tokens for a share of both.
 * The minimums allow the price to move by the slippage before the transaction lands.
 */

export const BETTERSWAP_V2_ROUTER = '0x349ede93b675c0f0f8d7cdad74ecf1419943e6ac'

export const router = {
    addLiquidity: fn('addLiquidity', [['address', 'tokenA'], ['address', 'tokenB'], ['uint256', 'amountADesired'], ['uint256', 'amountBDesired'], ['uint256', 'amountAMin'], ['uint256', 'amountBMin'], ['address', 'to'], ['uint256', 'deadline']]),
    addLiquidityETH: fn('addLiquidityETH', [['address', 'token'], ['uint256', 'amountTokenDesired'], ['uint256', 'amountTokenMin'], ['uint256', 'amountETHMin'], ['address', 'to'], ['uint256', 'deadline']], [], true),
    removeLiquidity: fn('removeLiquidity', [['address', 'tokenA'], ['address', 'tokenB'], ['uint256', 'liquidity'], ['uint256', 'amountAMin'], ['uint256', 'amountBMin'], ['address', 'to'], ['uint256', 'deadline']]),
    removeLiquidityETH: fn('removeLiquidityETH', [['address', 'token'], ['uint256', 'liquidity'], ['uint256', 'amountTokenMin'], ['uint256', 'amountETHMin'], ['address', 'to'], ['uint256', 'deadline']])
}

type Clause = { to: string, value: string, data: string }

/** the router a pool trades through; only BetterSwap's own V2 router is used */
export function routerOf(pool: Pool & { dex?: { routerAddress?: string } }): string | null {
    return pool.version === 'v2' && (pool.dex?.routerAddress || '').toLowerCase() === BETTERSWAP_V2_ROUTER ? BETTERSWAP_V2_ROUTER : null
}

const isVet = (t: { address: string }) => !t.address

/** the other token's amount at the pool's ratio, for an amount of one side (both in wei) */
export function pairAmount(pool: Pool, side: 0 | 1, amount: bigint): bigint {
    const r0 = BigInt(pool.reserve0?.raw || 0)
    const r1 = BigInt(pool.reserve1?.raw || 0)
    if (r0 === 0n || r1 === 0n) return 0n
    return side === 0 ? amount * r1 / r0 : amount * r0 / r1
}

/** what LP tokens are worth in both tokens now (wei) */
export function shareOf(pool: Pool, lp: bigint): { amount0: bigint, amount1: bigint } {
    const supply = BigInt(pool.totalSupply?.raw || 0)
    if (supply === 0n) return { amount0: 0n, amount1: 0n }
    return {
        amount0: lp * BigInt(pool.reserve0?.raw || 0) / supply,
        amount1: lp * BigInt(pool.reserve1?.raw || 0) / supply
    }
}

/** an amount less the slippage (in percent) */
export function minus(amount: bigint, slippage: number): bigint {
    const bp = BigInt(Math.round(Math.min(Math.max(slippage, 0), 50) * 100))
    return amount * (10000n - bp) / 10000n
}

/** approvals of exactly the amounts, then the add */
export function addClauses(pool: Pool, owner: string, amount0: bigint, amount1: bigint, slippage: number, deadline: number): Clause[] {
    const r = BETTERSWAP_V2_ROUTER
    const t0 = pool.token0
    const t1 = pool.token1
    if (isVet(t0) || isVet(t1)) {
        const [token, tokenAmount, vetAmount] = isVet(t0) ? [t1, amount1, amount0] : [t0, amount0, amount1]
        return [
            { to: token.address, value: '0', data: fns.approve.encode(r, tokenAmount.toString()) },
            { to: r, value: vetAmount.toString(), data: router.addLiquidityETH.encode(token.address, tokenAmount.toString(), minus(tokenAmount, slippage).toString(), minus(vetAmount, slippage).toString(), owner, deadline) }
        ]
    }
    return [
        { to: t0.address, value: '0', data: fns.approve.encode(r, amount0.toString()) },
        { to: t1.address, value: '0', data: fns.approve.encode(r, amount1.toString()) },
        { to: r, value: '0', data: router.addLiquidity.encode(t0.address, t1.address, amount0.toString(), amount1.toString(), minus(amount0, slippage).toString(), minus(amount1, slippage).toString(), owner, deadline) }
    ]
}

/** the LP tokens approved to the router, then the removal */
export function removeClauses(pool: Pool, owner: string, lp: bigint, slippage: number, deadline: number): Clause[] {
    const r = BETTERSWAP_V2_ROUTER
    const { amount0, amount1 } = shareOf(pool, lp)
    const approve = { to: pool.poolAddress, value: '0', data: fns.approve.encode(r, lp.toString()) }
    const t0 = pool.token0
    const t1 = pool.token1
    if (isVet(t0) || isVet(t1)) {
        const [token, tokenAmount, vetAmount] = isVet(t0) ? [t1, amount1, amount0] : [t0, amount0, amount1]
        return [approve, { to: r, value: '0', data: router.removeLiquidityETH.encode(token.address, lp.toString(), minus(tokenAmount, slippage).toString(), minus(vetAmount, slippage).toString(), owner, deadline) }]
    }
    return [approve, { to: r, value: '0', data: router.removeLiquidity.encode(t0.address, t1.address, lp.toString(), minus(amount0, slippage).toString(), minus(amount1, slippage).toString(), owner, deadline) }]
}
