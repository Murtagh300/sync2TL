import { describe, expect, it } from 'vitest'
import { koinlyDate, koinlyRows, plainDecimal } from 'src/utils/tax-export'
import type { Flow } from 'src/utils/overview'

const VET = '0x0000000000000000000000000000000000000000'
const B3TR = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
const SPAM = '0x00000000000000000000000000000000005ba111'
const tokens: Record<string, { symbol: string, decimals: number }> = { [VET]: { symbol: 'VET', decimals: 18 }, [B3TR]: { symbol: 'B3TR', decimals: 18 } }
const token = (a: string) => tokens[a]
const E18 = 10n ** 18n
const flow = (txId: string, dir: 'in' | 'out', t: string, amount: bigint, time = Date.UTC(2025, 2, 4, 12, 30, 5)): Flow =>
    ({ time, txId, dir, token: t, amount, counterparty: '0xabc', origin: '0xme' })

describe('plainDecimal', () => {
    it('writes whole units with a dot and no grouping', () => {
        expect(plainDecimal(1234567n * E18 + 5n * 10n ** 17n, 18)).toBe('1234567.5')
        expect(plainDecimal(1n, 18)).toBe('0.000000000000000001')
        expect(plainDecimal(3n * E18, 18)).toBe('3')
    })
})

describe('koinlyRows', () => {
    it('makes a swap one trade row with the fee', () => {
        const rows = koinlyRows([flow('0x1', 'out', VET, 100n * E18), flow('0x1', 'in', B3TR, 250n * E18)], token, new Map([['0x1', 2n * 10n ** 17n]]))
        expect(rows).toEqual([[koinlyDate(Date.UTC(2025, 2, 4, 12, 30, 5)), '100', 'VET', '250', 'B3TR', '0.2', 'VTHO', '', '', '', '', '0x1']])
        expect(rows[0]![0]).toBe('2025-03-04 12:30:05 UTC')
    })

    it('writes a plain receive and send with the other side', () => {
        const rows = koinlyRows([flow('0x2', 'in', B3TR, 5n * E18), flow('0x3', 'out', VET, E18)], token, new Map())
        expect(rows.map(r => [r[1], r[2], r[3], r[4], r[10]])).toEqual([
            ['', '', '5', 'B3TR', 'from 0xabc'],
            ['1', 'VET', '', '', 'to 0xabc']
        ])
    })

    it('leaves out unknown tokens, and a transaction of only those', () => {
        const rows = koinlyRows([flow('0x4', 'in', SPAM, 9n * E18), flow('0x5', 'out', VET, E18), flow('0x5', 'in', SPAM, E18)], token, new Map())
        expect(rows.length).toBe(1)
        expect(rows[0]!.slice(1, 5)).toEqual(['1', 'VET', '', ''])
    })

    it('puts the fee on the first row only when a transaction has several', () => {
        const rows = koinlyRows([flow('0x6', 'out', VET, E18), flow('0x6', 'out', B3TR, E18)], token, new Map([['0x6', 10n ** 17n]]))
        expect(rows.map(r => r[5])).toEqual(['0.1', ''])
    })

    it('labels VeBetterDAO rewards as income', () => {
        const f = { ...flow('0x7', 'in', B3TR, 8n * E18), counterparty: '0x6bee7ddab6c99d5b2af0554eaea484ce18f52631' }
        const [row] = koinlyRows([f], token, new Map())
        expect([row![9], row![10]]).toEqual(['reward', 'VeBetterDAO X2Earn'])
    })
})
