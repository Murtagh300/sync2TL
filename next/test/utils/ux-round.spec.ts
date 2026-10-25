import { describe, expect, it } from 'vitest'
import { Transaction } from 'thor-devkit'
import { parsePayout, payoutBatches, payoutTotal, duplicates, BATCH_SIZE } from 'src/utils/payout'
import { lookalike } from 'src/utils/recipient'
import { priceImpact } from 'src/utils/swap'
import { approvalsIn } from 'src/utils/leftover-approvals'
import { fns } from 'src/utils/actions'

const a1 = '0x8b9b4c1f5f3e0d7a2c6b5e4d3c2b1a0f9e8da6f3'
const a2 = '0x51a2000000000000000000000000000000077c0'.padEnd(42, '0')
const token = '0x0000000000000000000000000000456e65726779'

describe('paying many', () => {
    it('reads commas, semicolons with decimal commas, names and a header', () => {
        const { rows, errors } = parsePayout(`address,amount\n${a1}, 25, Prize\nalice.vet,10\n${a2}; 12,5\n\n# a comment`)
        expect(errors).toEqual([])
        expect(rows.map(r => [r.to, r.amount, r.note])).toEqual([[a1, '25', 'Prize'], ['alice.vet', '10', ''], [a2, '12.5', '']])
    })

    it('points at the lines that are wrong', () => {
        const { errors } = parsePayout(`${a1}, 1\nnot-an-address, 2\n${a1}, -3\n${a1}, abc`)
        expect(errors).toEqual([{ line: 2, key: 'address' }, { line: 3, key: 'amount' }, { line: 4, key: 'amount' }])
    })

    it('refuses a mixed-case address with a broken checksum', () => {
        const bad = '0x8B9b4c1f5f3e0d7a2c6b5e4d3c2b1a0f9e8da6f3'
        expect(parsePayout(`${bad}, 1`).errors).toEqual([{ line: 1, key: 'address' }])
    })

    it('totals, finds duplicates and splits into transactions', () => {
        const rows = parsePayout(`${a1}, 1.5\n${a1}, 2`).rows
        expect(payoutTotal(rows, 18)).toBe(3_500_000_000_000_000_000n)
        expect([...duplicates(rows)]).toEqual([a1])
        const many = Array.from({ length: BATCH_SIZE + 1 }, () => rows[0]!)
        const vet = payoutBatches(many, { address: '', decimals: 18, symbol: 'VET' })
        expect(vet.map(b => b.length)).toEqual([BATCH_SIZE, 1])
        expect(vet[0]![0]).toMatchObject({ to: a1, value: '1500000000000000000', data: '0x' })
        const [[t]] = payoutBatches(rows.slice(0, 1), { address: token, decimals: 18, symbol: 'VTHO' })
        expect(t).toMatchObject({ to: token, value: '0', data: fns.transfer.encode(a1, '1500000000000000000') })
    })
})

describe('look-alike addresses', () => {
    it('match on the same start and end, not on the same address', () => {
        const fake = a1.slice(0, 6) + '1'.repeat(30) + a1.slice(-4)
        expect(lookalike(fake, [a1, a2])).toBe(a1)
        expect(lookalike(a1, [a1])).toBeNull()
        expect(lookalike(a2, [a1])).toBeNull()
    })
})

describe('swap price impact', () => {
    it('compares what goes in and out at market prices', () => {
        const e18 = 10n ** 18n
        expect(priceImpact(100n * e18, 18, 0.02, 95n * e18, 18, 0.02)).toBeCloseTo(5)
        expect(priceImpact(100n * e18, 18, 0.02, 110n * e18, 18, 0.02)).toBe(0)
        expect(priceImpact(100n * e18, 18, undefined, 95n * e18, 18, 0.02)).toBeNull()
    })
})

describe('approvals left after a transaction', () => {
    it('are read from the approve clauses with an amount', () => {
        const spender = '0xd747aa9ba03dd778f1452e45d0fbe3a682b644cd'
        const tx = new Transaction({
            chainTag: 0x4a, blockRef: '0x0000000000000000', expiration: 32, gasPriceCoef: 0, gas: 100000, dependsOn: null, nonce: 1,
            clauses: [
                { to: token, value: 0, data: fns.approve.encode(spender, 500) },
                { to: token, value: 0, data: fns.approve.encode(spender, 0) },
                { to: spender, value: 0, data: '0x1841129c' }
            ]
        })
        expect(approvalsIn('0x' + tx.encode().toString('hex'))).toEqual([{ token, spender }])
        expect(approvalsIn('0xzz')).toEqual([])
    })
})

describe('shake to hide', () => {
    it('needs two hard jolts close together, then rests', async () => {
        const { shakeDetector } = await import('src/utils/shake')
        const shake = shakeDetector()
        expect(shake(30, 0, 9, 0)).toBe(false)
        expect(shake(30, 0, 9, 300)).toBe(true)
        // resting: no new shake right away
        expect(shake(30, 0, 9, 600)).toBe(false)
        expect(shake(30, 0, 9, 900)).toBe(false)
        // walking: below the threshold
        const walk = shakeDetector()
        expect(walk(3, 4, 12, 0) || walk(3, 4, 12, 200)).toBe(false)
        // too far apart
        const slow = shakeDetector()
        expect(slow(30, 0, 9, 0) || slow(30, 0, 9, 1000)).toBe(false)
    })
})
