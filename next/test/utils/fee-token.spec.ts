import { describe, expect, it } from 'vitest'
import type { Transaction } from 'thor-devkit'
import { maxFeeWei, verifyDelegated } from 'src/utils/fee-token'
import { fns } from 'src/utils/actions'
import { B3TR } from 'src/utils/ecosystem'

// the delegator hands back the body the user signs: anything beyond its own fee clause is refused

const DEPOSIT = '0x8692410da301a9b796b68a58ff660d51e979c6fa'
const ours: Transaction.LegacyBody = {
    chainTag: 0x4a,
    blockRef: '0x0140b3e2c0f4a1b2',
    expiration: 18,
    clauses: [{ to: '0x000000000000000000000000000000000000dead', value: '0x0de0b6b3a7640000', data: '0x' }],
    gasPriceCoef: 0,
    gas: 21000,
    dependsOn: null,
    nonce: '0x1234',
    reserved: { features: 1 }
}
const vetFee = { to: DEPOSIT, value: '0x847d3818f9640e', data: '0x' } // 0.0373 VET
const opts = { token: 'vet' as const, deposit: DEPOSIT, maxFee: 10n ** 17n }
const back = (patch: Partial<Transaction.LegacyBody> = {}): Transaction.LegacyBody =>
    ({ ...ours, clauses: [...ours.clauses, vetFee], gas: 37000, nonce: '0xabcd', ...patch })

describe('verifyDelegated', () => {
    it('takes the fee clause, a new gas and a new nonce', () => {
        expect(verifyDelegated(ours, back(), opts)).toBe(BigInt(vetFee.value))
    })

    it('refuses a changed recipient, amount or data of the user\'s clause', () => {
        const c = ours.clauses[0]!
        expect(() => verifyDelegated(ours, back({ clauses: [{ ...c, to: DEPOSIT }, vetFee] }), opts)).toThrow()
        expect(() => verifyDelegated(ours, back({ clauses: [{ ...c, value: '0x1bc16d674ec80000' }, vetFee] }), opts)).toThrow()
        expect(() => verifyDelegated(ours, back({ clauses: [{ ...c, data: '0x01' }, vetFee] }), opts)).toThrow()
    })

    it('refuses extra clauses, a missing fee clause or a fee to someone else', () => {
        expect(() => verifyDelegated(ours, back({ clauses: [...ours.clauses, vetFee, vetFee] }), opts)).toThrow()
        expect(() => verifyDelegated(ours, back({ clauses: [...ours.clauses] }), opts)).toThrow()
        expect(() => verifyDelegated(ours, back({ clauses: [...ours.clauses, { ...vetFee, to: '0x000000000000000000000000000000000000beef' }] }), opts)).toThrow()
    })

    it('refuses a fee above the cap', () => {
        expect(() => verifyDelegated(ours, back(), { ...opts, maxFee: 10n ** 15n })).toThrow()
    })

    it('refuses other changes to the body', () => {
        expect(() => verifyDelegated(ours, back({ blockRef: '0x0000000000000001' }), opts)).toThrow()
        expect(() => verifyDelegated(ours, back({ dependsOn: '0x' + '11'.repeat(32) }), opts)).toThrow()
        expect(() => verifyDelegated(ours, back({ reserved: undefined }), opts)).toThrow()
        expect(() => verifyDelegated(ours, back({ gas: 20000 }), opts)).toThrow()
    })

    it('reads a B3TR fee as a token transfer to the deposit account', () => {
        const amount = 47515634560292280n
        const b3trFee = { to: B3TR, value: '0x0', data: fns.transfer.encode(DEPOSIT, amount.toString()) }
        const b = back({ clauses: [...ours.clauses, b3trFee] })
        expect(verifyDelegated(ours, b, { ...opts, token: 'b3tr' })).toBe(amount)
        const elsewhere = { ...b3trFee, data: fns.transfer.encode('0x000000000000000000000000000000000000beef', amount.toString()) }
        expect(() => verifyDelegated(ours, back({ clauses: [...ours.clauses, elsewhere] }), { ...opts, token: 'b3tr' })).toThrow()
        // a VET fee clause doesn't pass for B3TR
        expect(() => verifyDelegated(ours, back(), { ...opts, token: 'b3tr' })).toThrow()
    })
})

describe('maxFeeWei', () => {
    it('allows three times the quote, at least a hundredth', () => {
        expect(maxFeeWei({ token: 'vet', cost: 0.05, gas: 37000 })).toBe(150000000000000000n)
        expect(maxFeeWei({ token: 'vet', cost: 0.001, gas: 37000 })).toBe(10000000000000000n)
    })
})
