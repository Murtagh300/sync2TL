import { describe, expect, it } from 'vitest'
import { bucketFor, rsi, sma, toCandles } from 'src/utils/candles'
import { moveClauses, perWeek, sgDelegation } from 'src/utils/validators'
import { STARGATE } from 'src/utils/ecosystem'
import { averageFee, surplus, txLeft, DEFAULT_FEE } from 'src/utils/vtho-tank'

const H = 3600 * 1000

describe('candles', () => {
    it('opens each candle at the close before it', () => {
        const pts = [1, 3, 2, 5, 4].map((price, i) => ({ time: i * H, price }))
        const c = toCandles(pts, 2 * H)
        expect(c).toEqual([
            { time: 0, open: 1, high: 3, low: 1, close: 3 },
            { time: 2 * H, open: 3, high: 5, low: 2, close: 5 },
            { time: 4 * H, open: 5, high: 5, low: 4, close: 4 }
        ])
    })

    it('averages and measures momentum', () => {
        expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
        expect(rsi([1, 2, 3, 4, 5], 3)).toBe(100)
        expect(rsi([5, 4, 3, 2, 1], 3)).toBe(0)
        expect(rsi([1, 2], 14)).toBeNull()
        expect(bucketFor(24)).toBe(H)
        expect(bucketFor(168)).toBe(4 * H)
        expect(bucketFor(720)).toBe(24 * H)
    })
})

describe('validators', () => {
    it('earnings per 10,000 delegated VET a week', () => {
        // a one-week period (60,480 blocks): 1,000 VTHO over 1M VET is 10 VTHO per 10k
        expect(perWeek(1000, 1_000_000, 60480)).toBeCloseTo(10)
        // a two-week period halves it
        expect(perWeek(1000, 1_000_000, 120960)).toBeCloseTo(5)
        expect(perWeek(0, 1_000_000, 60480)).toBeNull()
        expect(perWeek(10, 0, 60480)).toBeNull()
    })

    it('moves an NFT: delegate when free or waiting, exit first when active', () => {
        const to = '0x' + 'a'.repeat(40)
        const free = moveClauses({ tokenId: '7', validator: '0x' + '0'.repeat(40), status: 0, exitRequested: false }, to)
        expect(free.kind).toBe('delegate')
        expect(free.clauses).toEqual([{ to: STARGATE, value: '0', data: sgDelegation.delegate.encode('7', to) }])
        expect(moveClauses({ tokenId: '7', validator: to, status: 1, exitRequested: false }, to).kind).toBe('delegate')
        const active = moveClauses({ tokenId: '7', validator: to, status: 2, exitRequested: false }, to)
        expect(active.kind).toBe('exit')
        expect(active.clauses[0]!.data).toBe(sgDelegation.requestDelegationExit.encode('7'))
        expect(moveClauses({ tokenId: '7', validator: to, status: 2, exitRequested: true }, to)).toEqual({ kind: 'wait', clauses: [] })
        expect(moveClauses({ tokenId: '7', validator: to, status: 3, exitRequested: true }, to).kind).toBe('delegate')
    })
})

describe('the VTHO tank', () => {
    const me = '0x' + 'b'.repeat(40)
    const tx = (paid: number, payer = me, at = 1): M.Activity => ({
        id: at, gid: 'g', walletId: 1, createdTime: at, status: 'completed', type: 'tx',
        glob: { id: '0x', encoded: '', signer: me, origin: '', link: '', comment: '', receipt: { paid: '0x' + BigInt(Math.round(paid * 1e18)).toString(16), gasPayer: payer } as Connex.Thor.Transaction.Receipt }
    })

    it('averages what the address paid itself', () => {
        expect(averageFee([tx(0.2, me, 1), tx(0.4, me, 2), tx(9, '0x' + 'c'.repeat(40), 3)], me)).toBeCloseTo(0.3)
        expect(averageFee([], me)).toBe(DEFAULT_FEE)
    })

    it('counts transactions left and the surplus', () => {
        expect(txLeft(10, 0.3)).toBe(33)
        expect(surplus(65, 50)).toBe(15)
        expect(surplus(55, 50)).toBe(0)
    })
})
