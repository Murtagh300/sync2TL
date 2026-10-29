import { fns, isKnownSwapRouter, ZERO_ADDRESS } from './actions'
import { balanceChanges } from './simulate'

/**
 * Swaps: the best route of VeTrade's quote service (it aggregates the VeChain DEXes) and
 * BetterSwap's on-chain aggregator, asked side by side.
 * Clauses from the service are checked before they reach the sign dialog: they may only
 * use known routers, and a dry run must pay this account at least the minimum out.
 */

const VETRADE = 'https://vetrade.vet/api'
const VVET = '0x45429a2255e7248e57fce99e7239aed3f84b7a53'
// BetterSwap aggregator: a Uniswap V2 router interface over all VeChain DEXes
const AGGREGATOR = '0x23cbbf0265f55574490ab6eb1ed8730c71e23d6c'

export type Clause = { to: string, value: string, data: string }

export type Quote = {
    amountOut: bigint
    amountOutMin: bigint
    clauses: Clause[]
    /** who routes it */
    source: 'VeTrade' | 'BetterSwap'
}

/** the address a swap service uses for a token; VET is the zero address */
const tokenAddress = (address: string | null | undefined) => (address || ZERO_ADDRESS).toLowerCase()

async function vetradeQuote(thor: Connex.Thor, from: string, to: string, amountIn: bigint, slippageBps: number, account: string, signal?: AbortSignal): Promise<Quote> {
    const params = new URLSearchParams({
        amountIn: amountIn.toString(),
        fromAddress: from,
        toAddress: to,
        slippageBps: String(slippageBps),
        recipient: account,
        accountAddress: account
    })
    const resp = await fetch(`${VETRADE}/quote/insight?${params}`, { signal })
    const body = await resp.json() as { amountOut?: string, amountOutMin?: string, clauses?: { to: string, value: string | number, data: string }[], error?: string }
    if (!resp.ok || !body.amountOut || body.amountOut === '0') {
        throw new Error(body.error || 'no quote')
    }
    const clauses = (body.clauses || []).map(c => ({ to: c.to.toLowerCase(), value: BigInt(c.value || 0).toString(), data: c.data }))
    checkClauses(clauses, from, amountIn)
    const amountOutMin = BigInt(body.amountOutMin || body.amountOut)
    // known routers can still be told to pay someone else: the dry run must pay this account
    const received = await receivedInDryRun(thor, clauses, to, account)
    if (received < amountOutMin) {
        throw new Error('route does not pay this account')
    }
    return {
        amountOut: BigInt(body.amountOut),
        amountOutMin,
        clauses,
        source: 'VeTrade'
    }
}

/** how much of a token (VET: the zero address) the clauses pay to an account, net, in a dry run */
export async function receivedInDryRun(thor: Connex.Thor, clauses: Clause[], token: string, account: string): Promise<bigint> {
    const outputs = await thor.explain(clauses.map(c => ({ to: c.to, value: c.value, data: c.data })))
        .caller(account)
        .execute()
    if (outputs.length < clauses.length || outputs.some(o => o.reverted)) {
        throw new Error('route reverts')
    }
    const changes = balanceChanges(outputs, account)
    return token === ZERO_ADDRESS ? changes.vet : (changes.tokens[token] || 0n)
}

/**
 * a route from a service may only approve the input token to a known router and call
 * known routers, sending at most the input amount of VET
 */
export function checkClauses(clauses: Clause[], from: string, amountIn: bigint) {
    if (!clauses.length) {
        throw new Error('empty route')
    }
    for (const c of clauses) {
        const sel = c.data.slice(0, 10).toLowerCase()
        if (c.to === from && from !== ZERO_ADDRESS && sel === fns.approve.signature) {
            const spender = '0x' + c.data.slice(10 + 24, 10 + 64).toLowerCase()
            const amount = BigInt('0x' + c.data.slice(10 + 64, 10 + 128))
            if (!isKnownSwapRouter(spender) || amount > amountIn) {
                throw new Error('route approves an unknown spender')
            }
            continue
        }
        if (!isKnownSwapRouter(c.to)) {
            throw new Error('route calls an unknown contract')
        }
        const value = BigInt(c.value)
        if (value !== 0n && !(from === ZERO_ADDRESS && value === amountIn)) {
            throw new Error('route sends an unexpected amount')
        }
    }
}

async function aggregatorQuote(thor: Connex.Thor, from: string, to: string, amountIn: bigint, slippageBps: number, account: string): Promise<Quote> {
    const path = [from === ZERO_ADDRESS ? VVET : from, to === ZERO_ADDRESS ? VVET : to]
    const [out] = await thor.explain([{ to: AGGREGATOR, value: 0, data: fns.getAmountsOut.encode(amountIn.toString(), path) }]).execute()
    if (!out || out.reverted) {
        throw new Error('no route')
    }
    const amounts: string[] = fns.getAmountsOut.decode(out.data).amounts
    const amountOut = BigInt(amounts[amounts.length - 1] || 0)
    if (amountOut === 0n) {
        throw new Error('no liquidity')
    }
    const amountOutMin = amountOut * BigInt(10000 - slippageBps) / 10000n
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60
    let clauses: Clause[]
    if (from === ZERO_ADDRESS) {
        clauses = [{ to: AGGREGATOR, value: amountIn.toString(), data: fns.swapExactETHForTokens.encode(amountOutMin.toString(), path, account, deadline) }]
    } else {
        const swap = to === ZERO_ADDRESS
            ? fns.swapExactTokensForETH.encode(amountIn.toString(), amountOutMin.toString(), path, account, deadline)
            : fns.swapExactTokensForTokens.encode(amountIn.toString(), amountOutMin.toString(), path, account, deadline)
        clauses = [
            { to: from, value: '0', data: fns.approve.encode(AGGREGATOR, amountIn.toString()) },
            { to: AGGREGATOR, value: '0', data: swap }
        ]
    }
    return { amountOut, amountOutMin, clauses, source: 'BetterSwap' }
}

/**
 * price impact in %: how much less the output is worth than the input at market prices.
 * null when a price is missing; never below 0 (a route can beat the listed price).
 */
export function priceImpact(amountIn: bigint, decimalsIn: number, priceIn: number | undefined, amountOut: bigint, decimalsOut: number, priceOut: number | undefined): number | null {
    if (!priceIn || !priceOut) {
        return null
    }
    const valueIn = Number(amountIn) / 10 ** decimalsIn * priceIn
    const valueOut = Number(amountOut) / 10 ** decimalsOut * priceOut
    if (!(valueIn > 0)) {
        return null
    }
    return Math.max(0, (1 - valueOut / valueIn) * 100)
}

/**
 * price impact without market prices: how much worse this amount trades than a tiny amount on
 * BetterSwap's aggregator. A thin pool shows up here even for a token nobody prices.
 */
export async function depthImpact(thor: Connex.Thor, fromToken: string | null | undefined, toToken: string | null | undefined, amountIn: bigint, amountOut: bigint): Promise<number | null> {
    const from = tokenAddress(fromToken)
    const to = tokenAddress(toToken)
    const small = amountIn / 1000n > 0n ? amountIn / 1000n : 1n
    const path = [from === ZERO_ADDRESS ? VVET : from, to === ZERO_ADDRESS ? VVET : to]
    const [out] = await thor.explain([{ to: AGGREGATOR, value: 0, data: fns.getAmountsOut.encode(small.toString(), path) }]).execute()
    if (!out || out.reverted) return null
    const amounts: string[] = fns.getAmountsOut.decode(out.data).amounts
    const smallOut = BigInt(amounts[amounts.length - 1] || 0)
    if (smallOut === 0n || amountIn === 0n) return null
    // rates as numbers: the ratio is all that matters
    const rate = Number(amountOut) / Number(amountIn)
    const smallRate = Number(smallOut) / Number(small)
    return Math.max(0, (1 - rate / smallRate) * 100)
}

export type Pair = { from: string, to: string }
const PAIRS_KEY = 'bv-swap-pairs'

/** the pairs swapped lately, newest first */
export function recentPairs(): Pair[] {
    try {
        return (JSON.parse(localStorage.getItem(PAIRS_KEY) || '[]') as Pair[]).slice(0, 5)
    } catch {
        return []
    }
}

export function rememberPair(p: Pair) {
    const list = [p, ...recentPairs().filter(x => x.from !== p.from || x.to !== p.to)].slice(0, 5)
    try {
        localStorage.setItem(PAIRS_KEY, JSON.stringify(list))
    } catch { }
}

/**
 * the best quote: VeTrade's service and BetterSwap's on-chain aggregator are asked at once, and
 * the one that pays more wins (VeTrade often splits a route; BetterSwap sometimes has the deeper pool)
 */
export async function quote(
    thor: Connex.Thor,
    fromToken: string | null | undefined,
    toToken: string | null | undefined,
    amountIn: bigint,
    slippageBps: number,
    account: string,
    signal?: AbortSignal
): Promise<Quote> {
    const from = tokenAddress(fromToken)
    const to = tokenAddress(toToken)
    const [vetrade, betterswap] = await Promise.allSettled([
        vetradeQuote(thor, from, to, amountIn, slippageBps, account, signal),
        aggregatorQuote(thor, from, to, amountIn, slippageBps, account)
    ])
    if (signal?.aborted) {
        throw new Error('aborted')
    }
    if (vetrade.status === 'rejected') console.warn('VeTrade quote:', vetrade.reason)
    return bestQuote(vetrade.status === 'fulfilled' ? vetrade.value : null, betterswap.status === 'fulfilled' ? betterswap.value : null)
}

/** the quote that pays more; VeTrade on a tie (its routes are checked in a dry run) */
export function bestQuote(a: Quote | null, b: Quote | null): Quote {
    if (a && b) return b.amountOut > a.amountOut ? b : a
    const q = a || b
    if (!q) throw new Error('no route')
    return q
}
