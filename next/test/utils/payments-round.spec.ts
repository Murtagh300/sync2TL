import { describe, expect, it } from 'vitest'
import { abi } from 'thor-devkit'
import { keypad, tillAmount } from 'src/utils/pos'
import { receiptHtml } from 'src/utils/receipt'
import { cancelClause, collectClauses, isDue, planWei, subscribeClauses, type Plan, type Subscriber } from 'src/utils/subscriptions'

const ME = '0x' + 'a'.repeat(40)
const SUB = '0x' + 'b'.repeat(40)
const B3TR = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
const plan: Plan = { id: 'p', name: 'Club', to: ME, symbol: 'B3TR', token: B3TR, decimals: 18, amount: '2.5', every: 'month' }
const words = (data: string) => abi.decodeParameters([{ type: 'address', name: 'a' }, { type: 'uint256', name: 'v' }], '0x' + data.slice(10))

describe('till', () => {
    it('turns a price into a tagged token amount', () => {
        expect(tillAmount(10, 0.02, 1, 7)).toBe('500.0007')
        expect(tillAmount(10, 0, 1, 1)).toBeNull()
        expect(tillAmount(1, 0.03, 0.9, 150)).toBe('37.0499')
    })

    it('types like a till', () => {
        let v = ''
        for (const k of ['0', '1', '.', '5', '0', '9', '.']) v = keypad(v, k)
        expect(v).toBe('1.50')
        expect(keypad('1.5', 'back')).toBe('1.')
        expect(keypad('', '.')).toBe('0.')
    })
})

describe('receipt', () => {
    it('escapes what it shows and keeps only https links', () => {
        const html = receiptHtml({ title: '<b>x</b>', lines: [{ label: 'Note', value: '"><script>' }], link: 'javascript:alert(1)', footer: 'f' })
        expect(html).not.toContain('<script>')
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
        expect(html).not.toContain('javascript:')
    })
})

describe('subscriptions', () => {
    it('pays the first period and allows twelve more', () => {
        const [approve, pay] = subscribeClauses(plan, planWei(plan))
        expect(words(approve!.data).v).toBe((25n * 10n ** 17n * 12n).toString())
        expect(words(pay!.data).v).toBe((25n * 10n ** 17n).toString())
        expect(words(cancelClause(plan).data).v).toBe('0')
    })

    it('is due a month after the last payment, a day early allowed', () => {
        const now = Date.UTC(2026, 9, 29)
        expect(isDue(now - 29 * 86400e3, 'month', now)).toBe(true)
        expect(isDue(now - 20 * 86400e3, 'month', now)).toBe(false)
        expect(isDue(0, 'week', now)).toBe(true)
    })

    it('collects only from those who are due and covered', () => {
        const s = (address: string, collectable: boolean): Subscriber => ({ address, allowance: 1n, balance: 1n, lastPaid: 0, due: true, collectable })
        const clauses = collectClauses(plan, [s(SUB, true), s(ME, false)], planWei(plan))
        expect(clauses.length).toBe(1)
        const d = abi.decodeParameters([{ type: 'address', name: 'from' }, { type: 'address', name: 'to' }, { type: 'uint256', name: 'v' }], '0x' + clauses[0]!.data.slice(10))
        expect([d.from.toLowerCase(), d.to.toLowerCase()]).toEqual([SUB, ME])
    })
})
