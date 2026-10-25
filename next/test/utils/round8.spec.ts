import { describe, expect, it } from 'vitest'
import { totals, nftSales, monthRange, ZERO, type Flow } from 'src/utils/overview'
import { assignNfts, parseNftPayout } from 'src/utils/payout'
import { outgoingValue } from 'src/utils/spend-limit'
import { classify } from 'src/utils/node-health'
import { ruleHolds, type AlertRule } from 'src/utils/alerts'

const me = '0x00000000000000000000000000000000000000a1'
const token = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
// a BlackVeMarket marketplace contract (src/utils/known-markets.ts)
const market = '0x1dcce1ad683c00d6df3dc1639bbdc88a8b8fed09'
const flow = (dir: 'in' | 'out', amount: bigint, t = ZERO, counterparty = '0x00000000000000000000000000000000000000b2'): Flow =>
    ({ time: 0, txId: '0x1', dir, token: t, amount, counterparty, origin: me })

describe('month overview', () => {
    it('adds up what came in and went out per token', () => {
        const t = totals([flow('in', 5n), flow('in', 7n), flow('out', 3n), flow('out', 2n, token)])
        expect(t).toEqual([{ token: ZERO, in: 12n, out: 3n }, { token, in: 0n, out: 2n }])
    })

    it('counts payments from a marketplace as NFT sales', () => {
        expect(nftSales([flow('in', 9n, ZERO, market), flow('in', 4n), flow('out', 1n, ZERO, market)])).toHaveLength(1)
    })

    it('spans a whole month', () => {
        const [from, to] = monthRange(2026, 1)
        expect(new Date(from).getDate()).toBe(1)
        expect(new Date(to).getMonth()).toBe(1)
        expect(new Date(to + 1).getMonth()).toBe(2)
    })
})

describe('an NFT airdrop', () => {
    const owned = [
        { contract: '0xc', tokenId: '1' },
        { contract: '0xc', tokenId: '2', listed: true },
        { contract: '0xc', tokenId: '3' },
        { contract: '0xc', tokenId: '4' }
    ]
    const a = '0x' + 'a'.repeat(40)
    const b = '0x' + 'b'.repeat(40)

    it('reads an address with an optional token ID', () => {
        const { rows, errors } = parseNftPayout(`address,id\n${a}, 3\n${b}\nnope\n${a}, x`)
        expect(rows).toEqual([{ line: 2, to: a, tokenId: '3' }, { line: 3, to: b, tokenId: null }])
        expect(errors).toEqual([{ line: 4, key: 'address' }, { line: 5, key: 'amount' }])
    })

    it('gives named NFTs first and the next free one otherwise, never a listed one twice', () => {
        const { pairs, missing } = assignNfts([
            { line: 1, to: a, tokenId: null },
            { line: 2, to: b, tokenId: '1' },
            { line: 3, to: a, tokenId: '2' },
            { line: 4, to: b, tokenId: null },
            { line: 5, to: a, tokenId: null }
        ], owned)
        expect(pairs.map(p => [p.row.line, p.nft.tokenId])).toEqual([[1, '3'], [2, '1'], [4, '4']])
        // #2 is listed; nothing left for line 5
        expect(missing).toEqual([3, 5])
    })
})

describe('the spending limit', () => {
    it('values what leaves the wallet', () => {
        const changes = { vet: -100n * 10n ** 18n, tokens: { [token]: -50n * 10n ** 18n, '0xdead': 10n }, nfts: [] }
        const v = outgoingValue(changes, { [ZERO]: 0.02, [token]: 0.1 }, () => 18, 0.9)
        expect(v).toBeCloseTo((100 * 0.02 + 50 * 0.1) * 0.9)
    })
})

describe('node health and alerts', () => {
    it('sorts a ping into ok, slow and down', () => {
        expect([classify(300), classify(2500), classify(-1)]).toEqual(['ok', 'slow', 'down'])
    })

    it('holds a token rule at and past its value', () => {
        const rule: AlertRule = { id: 'x', slug: '', token: ZERO, name: 'VET', kind: 'above', value: 0.03, currency: 'EUR' }
        expect([ruleHolds(rule, 0.029), ruleHolds(rule, 0.03), ruleHolds({ ...rule, kind: 'below' }, 0.02)]).toEqual([false, true, true])
    })
})

describe('floor history', () => {
    it('keeps the last floor on days without a record, up to today', async () => {
        const { dailyFloors } = await import('src/utils/floors')
        const DAY = 24 * 3600 * 1000
        const now = 100 * DAY
        const points = [
            { time: 80 * DAY, value: 5, currency: 'VET' },
            { time: 95 * DAY, value: 4, currency: 'VET' }
        ]
        const week = dailyFloors(points, 7, now)
        expect(week).toHaveLength(8)
        // day 93: still the floor of day 80
        expect(week[0]!.value).toBe(5)
        expect(week[week.length - 1]!.value).toBe(4)
        const month = dailyFloors(points, 30, now)
        // from the first record on: 5 until day 95, then 4
        expect(month[0]!.value).toBe(5)
        expect(month.filter(p => p.value === 4)).toHaveLength(6)
    })
})
