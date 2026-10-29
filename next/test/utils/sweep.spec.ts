import { describe, expect, it } from 'vitest'
import { sweepClauses } from 'src/utils/sweep'

const E18 = 10n ** 18n
const specs = [
    { symbol: 'VET', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    { symbol: 'VTHO', address: '0x0000000000000000000000000000456e65726779', decimals: 18 },
    { symbol: 'B3TR', address: '0x5ef79995fe8a89e0812330e4378eb2660cede699', decimals: 18 }
]
const TO = '0x' + 'a'.repeat(40)

describe('sweepClauses', () => {
    it('sends tokens, then VET, and VTHO minus the reserve', () => {
        const { clauses, parts } = sweepClauses(specs, [5n * E18, 30n * E18, 7n * E18], TO)
        expect(clauses.map(c => c.to)).toEqual([specs[2]!.address, TO, specs[1]!.address])
        expect(clauses[1]!.value).toBe((5n * E18).toString())
        expect(parts).toEqual(['5 VET', '7 B3TR', '20 VTHO'])
    })

    it('leaves VTHO under the reserve and skips empty balances', () => {
        const { clauses } = sweepClauses(specs, [0n, 9n * E18, 0n], TO)
        expect(clauses).toEqual([])
    })
})
