import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { abi } from 'thor-devkit'
import { currencySign, isCurrency, parseEcb, perDollar } from 'src/utils/fiat'
import { dequeue, enqueue, MAX_QUEUE, queueClauses, queueOf, queueTotals, sendQueue } from 'src/utils/send-queue'
import { checkPasted, noteCopied, WINDOW } from 'src/utils/clipboard-guard'
import { recentPayments, rememberPayment } from 'src/utils/last-payments'
import { claimClauses, roundsToCheck, VOTER_REWARDS } from 'src/utils/voter-rewards'
import { goalProgress, onTrack } from 'src/utils/impact-goal'
import { dailySpend, forecast, weeklyIncome } from 'src/utils/vtho-forecast'
import { addClauses, BETTERSWAP_V2_ROUTER, minus, pairAmount, removeClauses, routerOf, shareOf } from 'src/utils/liquidity-v2'
import { statsFromRewards } from 'src/utils/x2earn'
import { yearStats } from 'src/utils/year-review'
import { canUnstake, sg, STARGATE, stakeClause } from 'src/utils/ecosystem'
import type { Pool } from 'src/utils/liquidity'
import type { Flow } from 'src/utils/overview'

const E18 = 10n ** 18n
const A = '0x' + 'a'.repeat(40)
const B = '0x' + 'b'.repeat(40)
const B3TR = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
// the wallet's per-device memory, in memory
beforeAll(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
        const m = new Map<string, string>()
        vi.stubGlobal(name, { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k), clear: () => m.clear() })
    }
})

const word = (data: string, i: number) => BigInt('0x' + data.slice(10 + i * 64, 10 + (i + 1) * 64))

describe('currencies', () => {
    it('reads the ECB file and turns its euro rates into units per dollar', () => {
        const rates = parseEcb(`<Cube currency='USD' rate='1.08'/><Cube currency='GBP' rate='0.864'/><Cube currency="JPY" rate="162"/>`)
        expect(rates).toEqual({ USD: 1.08, GBP: 0.864, JPY: 162 })
        expect(perDollar(rates, 'USD')).toBe(1)
        expect(perDollar(rates, 'EUR')).toBeCloseTo(1 / 1.08)
        expect(perDollar(rates, 'GBP')).toBeCloseTo(0.8)
        expect(perDollar(rates, 'CHF')).toBe(0)
        expect(isCurrency('PLN')).toBe(true)
        expect(isCurrency('XYZ')).toBe(false)
        expect(currencySign('EUR', 'nl-NL')).toBe('€')
        expect(currencySign('USD', 'en-US')).toBe('$')
    })
})

describe('send queue', () => {
    beforeEach(() => { sendQueue.items = [] })

    it('one clause per payment, VET as value and tokens as transfer', () => {
        enqueue({ gid: 'g', from: A.toUpperCase().replace('0X', '0x'), to: B, symbol: 'VET', token: '', decimals: 18, amount: '1.5' })
        enqueue({ gid: 'g', from: A, to: B, symbol: 'B3TR', token: B3TR, decimals: 18, amount: '2' })
        enqueue({ gid: 'g', from: A, to: B, symbol: 'VET', token: '', decimals: 18, amount: '0.25' })
        const items = queueOf('g', A)
        expect(items).toHaveLength(3)
        const [vet, token] = queueClauses(items)
        expect(vet).toMatchObject({ to: B, value: (15n * E18 / 10n).toString(), data: '0x' })
        expect(token!.to).toBe(B3TR)
        expect(token!.data.slice(0, 10)).toBe('0xa9059cbb')
        expect(word(token!.data, 1)).toBe(2n * E18)
        expect(queueTotals(items)).toEqual({ VET: '1.75', B3TR: '2' })
        dequeue([items[0]!.id])
        expect(queueOf('g', A)).toHaveLength(2)
        expect(queueOf('other', A)).toHaveLength(0)
    })

    it('stops at the limit', () => {
        for (let i = 0; i < MAX_QUEUE; i++) expect(enqueue({ gid: 'g', from: A, to: B, symbol: 'VET', token: '', decimals: 18, amount: '1' })).toBe(true)
        expect(enqueue({ gid: 'g', from: A, to: B, symbol: 'VET', token: '', decimals: 18, amount: '1' })).toBe(false)
    })
})

describe('clipboard guard', () => {
    const copied = '0x1234' + 'a'.repeat(32) + '5678'
    it('a look-alike paste is a swap, another address worth a look, the same or late nothing', () => {
        const c = { address: copied, at: 1000 }
        expect(checkPasted('0x1234' + 'b'.repeat(32) + '5678', 2000, c)).toBe('swapped')
        expect(checkPasted('0x9999' + 'b'.repeat(32) + '0000', 2000, c)).toBe('different')
        expect(checkPasted(copied.toUpperCase().replace('0X', '0x'), 2000, c)).toBeNull()
        expect(checkPasted('0x9999' + 'b'.repeat(32) + '0000', 1000 + WINDOW + 1, c)).toBeNull()
        expect(checkPasted('hello', 2000, c)).toBeNull()
        expect(checkPasted(copied, 2000, null)).toBeNull()
    })
    it('remembers only addresses it copied', () => {
        noteCopied('not an address')
        noteCopied(copied, Date.now())
        expect(checkPasted('0x1234' + 'c'.repeat(32) + '5678')).toBe('swapped')
    })
})

describe('send again', () => {
    it('the latest payments first, leaving out own addresses', () => {
        rememberPayment(A, '5', 'VET', 1000)
        rememberPayment(B, '7', 'B3TR', 2000)
        const list = recentPayments(3, [A])
        expect(list[0]).toMatchObject({ address: B, amount: '7', symbol: 'B3TR' })
        expect(list.some(p => p.address === A)).toBe(false)
    })
})

describe('voting rewards', () => {
    it('looks at ended rounds only, newest first, and claims each one', () => {
        expect(roundsToCheck(122, 3)).toEqual([121, 120, 119])
        expect(roundsToCheck(2)).toEqual([1])
        const [c] = claimClauses([{ round: 121, address: A, amount: 5n }])
        expect(c!.to).toBe(VOTER_REWARDS)
        // claimReward(uint256,address)
        const f = new abi.Function({ type: 'function', name: 'claimReward', constant: false, payable: false, stateMutability: 'nonpayable', inputs: [{ type: 'uint256', name: 'c' }, { type: 'address', name: 'v' }], outputs: [] })
        expect(c!.data.slice(0, 10)).toBe(f.signature)
        expect(word(c!.data, 0)).toBe(121n)
    })
})

describe('impact goal', () => {
    it('counts in the unit people read and tells whether the year is on track', () => {
        const p = goalProgress({ key: 'carbon', target: 50, year: 2026 }, { carbon: 20000 })
        expect(p).toEqual({ done: 20, share: 0.4 })
        expect(goalProgress({ key: 'water', target: 10, year: 2026 }, { water: 50000 }).share).toBe(1)
        expect(onTrack(0.4, new Date(2026, 3, 1))).toBe(true)
        expect(onTrack(0.4, new Date(2026, 9, 29))).toBe(false)
    })
})

describe('VTHO forecast', () => {
    it('income from delegated NFTs against what fees cost', () => {
        expect(weeklyIncome([{ staked: 10000, perWeek: 3 }, { staked: 50000, perWeek: 2 }, { staked: 1000000, perWeek: null }])).toBe(13)
        expect(forecast(100, 14, 1, 0.5)).toEqual({ weekly: 14, txPerMonth: 120, daysLeft: null })
        expect(forecast(100, 7, 6, 0.5)).toEqual({ weekly: 7, txPerMonth: 60, daysLeft: 20 })
        const tx = (signer: string, payer: string, paid: bigint, t: number) => ({ type: 'tx', createdTime: t, glob: { signer, receipt: { gasPayer: payer, paid: '0x' + paid.toString(16) } } }) as unknown as M.Activity
        const now = 100 * 86400 * 1000
        expect(dailySpend([tx(A, A, 3n * E18, now - 1000), tx(A, B, 9n * E18, now - 1000), tx(A, A, 9n * E18, now - 40 * 86400 * 1000)], A, 30, now)).toBeCloseTo(0.1)
    })
})

describe('liquidity on BetterSwap V2', () => {
    const pool = {
        poolAddress: '0x' + 'c'.repeat(40),
        version: 'v2',
        feeTier: 3000,
        token0: { address: B3TR, symbol: 'B3TR', decimals: 18, image: '' },
        token1: { address: '', symbol: 'VET', decimals: 18, image: '' },
        reserve0: { formatted: '1000', decimals: 18, raw: (1000n * E18).toString() },
        reserve1: { formatted: '4000', decimals: 18, raw: (4000n * E18).toString() },
        totalSupply: { formatted: '2000', decimals: 18, raw: (2000n * E18).toString() },
        totalUsdValue: 0,
        apy: 0,
        dex: { routerAddress: BETTERSWAP_V2_ROUTER, wvetAddress: '0x' + 'd'.repeat(40) }
    } as Pool & { dex: { routerAddress: string } }

    it('keeps to the pool\'s ratio and only uses BetterSwap\'s router', () => {
        expect(pairAmount(pool, 0, 10n * E18)).toBe(40n * E18)
        expect(pairAmount(pool, 1, 40n * E18)).toBe(10n * E18)
        expect(shareOf(pool, 200n * E18)).toEqual({ amount0: 100n * E18, amount1: 400n * E18 })
        expect(minus(1000n, 1)).toBe(990n)
        expect(routerOf(pool)).toBe(BETTERSWAP_V2_ROUTER)
        expect(routerOf({ ...pool, dex: { routerAddress: '0x' + 'e'.repeat(40) } } as Pool)).toBeNull()
    })

    it('VET goes as value through the ETH functions, approvals are exact', () => {
        const add = addClauses(pool, A, 10n * E18, 40n * E18, 1, 99)
        expect(add).toHaveLength(2)
        expect(add[0]!.to).toBe(B3TR)
        expect(word(add[0]!.data, 1)).toBe(10n * E18)
        expect(add[1]!.to).toBe(BETTERSWAP_V2_ROUTER)
        expect(add[1]!.value).toBe((40n * E18).toString())
        // addLiquidityETH(token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline)
        expect(word(add[1]!.data, 2)).toBe(99n * E18 / 10n)
        const out = removeClauses(pool, A, 200n * E18, 1, 99)
        expect(out[0]!.to).toBe(pool.poolAddress)
        expect(word(out[0]!.data, 1)).toBe(200n * E18)
        // removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, to, deadline)
        expect(word(out[1]!.data, 3)).toBe(396n * E18)
    })
})

describe('X2Earn app stats', () => {
    it('reward per action and the impact most proofs state', () => {
        const p = (impact: Record<string, number>) => JSON.stringify({ version: 2, impact })
        const stats = statsFromRewards([
            { appId: 'x', amount: 2n * E18, proof: p({ carbon: 5 }) },
            { appId: 'x', amount: 4n * E18, proof: p({ carbon: 5, water: 1 }) },
            ...Array.from({ length: 18 }, () => ({ appId: 'x', amount: 3n * E18, proof: p({ carbon: 1 }) })),
            { appId: 'y', amount: E18, proof: 'nope' }
        ])
        expect(stats.x!.actions).toBe(20)
        expect(stats.x!.perAction).toBe(3)
        expect(stats.x!.impact).toEqual(['carbon'])
        expect(stats.y).toEqual({ actions: 1, perAction: 1, impact: [] })
    })
})

describe('year in review', () => {
    it('counts transactions, days and people, leaving out own moves', () => {
        const t = (m: number, d: number) => new Date(2026, m, d, 12).getTime()
        const f = (txId: string, time: number, dir: 'in' | 'out', counterparty: string, amount: bigint, token = '0x0000000000000000000000000000000000000000'): Flow => ({ txId, time, dir, counterparty, amount, token, origin: A })
        const s = yearStats(2026, [
            f('1', t(2, 1), 'in', B, 10n * E18),
            f('2', t(2, 1), 'out', B, 4n * E18),
            f('3', t(5, 3), 'out', '0x' + 'e'.repeat(40), E18),
            f('4', t(5, 4), 'out', A, 99n * E18),
            f('5', new Date(2025, 11, 31).getTime(), 'in', B, E18)
        ], [A], [{ amount: 2n * E18, time: t(1, 1) }, { amount: E18, time: new Date(2025, 5, 1).getTime() }])
        expect(s.transactions).toBe(3)
        expect(s.activeDays).toBe(2)
        expect(s.busiestMonth).toBe(2)
        expect(s.people).toBe(2)
        expect(s.totals['0x0000000000000000000000000000000000000000']).toEqual({ in: 10n * E18, out: 5n * E18 })
        expect(s.rewards).toEqual({ count: 1, amount: 2n * E18 })
        expect(yearStats(2026, [], [A]).busiestMonth).toBeNull()
    })
})

describe('StarGate staking', () => {
    it('pays the level\'s VET exactly, and unstakes only what no validator uses', () => {
        const c = stakeClause({ id: 8, name: 'Dawn', vet: 10000n * E18, maturityDays: 2, minted: 1, cap: 10 })
        expect(c.to).toBe(STARGATE)
        expect(c.value).toBe((10000n * E18).toString())
        expect(c.data.slice(0, 10)).toBe(sg.stake.signature)
        expect(word(c.data, 0)).toBe(8n)
        expect(canUnstake({ status: 'none' })).toBe(true)
        expect(canUnstake({ status: 'exited' })).toBe(true)
        expect(canUnstake({ status: 'active' })).toBe(false)
    })
})
