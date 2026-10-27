import { describe, expect, it } from 'vitest'
import { decimalSeparator, formatAmount, formatDate, formatUnits, plainUnits, setNumberLocale, toWei } from 'src/utils/format'

// amounts are what the user sees before signing: the output must not change
// across bignumber.js upgrades

describe('formatAmount', () => {
    it('groups thousands and keeps all decimals by default', () => {
        expect(formatAmount('1234567.891')).toEqual({ int: '1,234,567', dec: '891', sep: '.' })
        expect(formatAmount('12')).toEqual({ int: '12', dec: undefined, sep: '.' })
    })

    it('converts from the smallest unit', () => {
        expect(formatAmount('1000000000000000000', { unit: 18 })).toEqual({ int: '1', dec: undefined, sep: '.' })
        expect(formatAmount('1500000000000000000', { unit: 18 })).toEqual({ int: '1', dec: '5', sep: '.' })
        expect(formatAmount('1', { unit: 18 })).toEqual({ int: '0', dec: '000000000000000001', sep: '.' })
    })

    it('rounds down to a fixed number of decimals', () => {
        expect(formatAmount('1.239', { fixed: 2 })).toEqual({ int: '1', dec: '23', sep: '.' })
        expect(formatAmount('0.999999', { fixed: 2 })).toEqual({ int: '0', dec: '99', sep: '.' })
        expect(formatAmount('1234.5', { fixed: 0 })).toEqual({ int: '1,234', dec: undefined, sep: '.' })
    })

    it('pads but never cuts with fullPrecision', () => {
        expect(formatAmount('1.2', { fullPrecision: true, fixed: 4 })).toEqual({ int: '1', dec: '2000', sep: '.' })
        expect(formatAmount('1.23456', { fullPrecision: true, fixed: 2 })).toEqual({ int: '1', dec: '23456', sep: '.' })
        expect(formatAmount('5', { fullPrecision: true, fixed: 2 })).toEqual({ int: '5', dec: '00', sep: '.' })
        expect(formatAmount('5', { fullPrecision: true })).toEqual({ int: '5', dec: undefined, sep: '.' })
    })

    it('handles hex balances as returned by the node', () => {
        expect(formatAmount('0xde0b6b3a7640000', { unit: 18, fixed: 2 })).toEqual({ int: '1', dec: '00', sep: '.' })
    })

    it('rejects values that are not finite numbers', () => {
        expect(formatAmount('abc')).toBeNull()
        expect(formatAmount(NaN)).toBeNull()
        expect(formatAmount(Infinity)).toBeNull()
    })

    it('uses a dot as decimal separator', () => {
        expect(decimalSeparator()).toBe('.')
    })
})

describe('toWei', () => {
    it('converts to the smallest unit and rounds down', () => {
        expect(toWei('1.5', 18)).toBe('1500000000000000000')
        expect(toWei('0.0000000000000000019', 18)).toBe('1')
        expect(toWei('100', 6)).toBe('100000000')
    })
})

describe('formatDate', () => {
    // past dates never read "in a minute"
    it('shows recent dates relative to now', () => {
        expect(formatDate(Date.now() - 60 * 1000, { relative: true })).toBe('a minute ago')
    })

    it('shows the full date and time when not relative', () => {
        const old = new Date(2024, 0, 2, 3, 4, 5).getTime()
        expect(formatDate(old)).toBe('01/02/2024 03:04:05')
    })

    // today/yesterday, the weekday, then a short date
    it('reads older dates in words', () => {
        const at = (daysAgo: number, h: number) => {
            const d = new Date()
            d.setDate(d.getDate() - daysAgo)
            d.setHours(h, 5, 0, 0)
            return d.getTime()
        }
        expect(formatDate(at(1, 9), { relative: true })).toBe('Yesterday, 09:05')
        expect(formatDate(at(3, 9), { relative: true })).toMatch(/^[A-Z][a-z]+day 09:05$/)
        expect(formatDate(new Date(2024, 0, 2, 3, 4, 5).getTime(), { relative: true })).toBe('2 Jan 2024')
    })
})

describe('setNumberLocale', () => {
    it('writes amounts the way the app language does, and back', () => {
        try {
            setNumberLocale('nl-nl')
            expect(formatUnits(1234500000000000000000n, 18)).toBe('1.234,5')
            expect(decimalSeparator()).toBe(',')
            setNumberLocale('de-de')
            expect(formatAmount('1234.5')).toEqual({ int: '1.234', dec: '5', sep: ',' })
        } finally {
            setNumberLocale('en-US')
        }
        expect(formatUnits(1234500000000000000000n, 18)).toBe('1,234.5')
    })

    it('keeps amounts for a field plain, whatever the language', () => {
        try {
            setNumberLocale('nl-nl')
            expect(plainUnits(1234500000000000000000n, 18)).toBe('1234.5')
            expect(plainUnits('1', 18)).toBe('0.000000000000000001')
        } finally {
            setNumberLocale('en-US')
        }
    })
})
