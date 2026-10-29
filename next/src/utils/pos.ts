import { BigNumber } from 'bignumber.js'

/**
 * The till: a price in euros (or dollars) as an amount of a token, at today's price. Each amount
 * gets its own last digits (0.0001 to 0.0099 more), so the wallet can tell which payment is
 * which by the exact amount, as with payment requests.
 */

/** the token amount for a fiat price; null without a price */
export function tillAmount(fiat: number, tokenPriceUsd: number, fx: number, tag: number): string | null {
    const perToken = tokenPriceUsd * fx
    if (!(fiat > 0) || !(perToken > 0)) return null
    const base = new BigNumber(fiat).div(perToken).decimalPlaces(2, BigNumber.ROUND_UP)
    const t = Math.min(99, Math.max(1, Math.floor(tag)))
    return base.plus(new BigNumber(t).times('0.0001')).toFixed()
}

/** a keypad press on an amount typed as text: digits, one separator, two decimals */
export function keypad(current: string, key: string): string {
    if (key === 'back') return current.slice(0, -1)
    if (key === 'clear') return ''
    if (key === '.') {
        if (current.includes('.')) return current
        return (current || '0') + '.'
    }
    if (!/^\d$/.test(key)) return current
    const [, dec] = current.split('.')
    if (dec !== undefined && dec.length >= 2) return current
    if (current === '0') return key
    // a till doesn't take more than a million
    if (!current.includes('.') && current.length >= 7) return current
    return current + key
}

/** a till sale as the day overview reads it: a paid request with the price it was asked at */
export type TillSale = { amount: string, symbol: string, fiat?: number, currency?: string, paid?: { at: number, txId: string, from: string } }

export type TillDay = { day: string, count: number, fiat: Record<string, number>, tokens: Record<string, string> }

/** the paid till sales per day (local time), newest day first */
export function tillDays(sales: TillSale[]): TillDay[] {
    const days = new Map<string, TillDay>()
    for (const s of sales) {
        if (!s.paid || s.fiat === undefined || !s.currency) continue
        const d = new Date(s.paid.at)
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const t = days.get(day) || { day, count: 0, fiat: {}, tokens: {} }
        t.count++
        t.fiat[s.currency] = Math.round(((t.fiat[s.currency] || 0) + s.fiat) * 100) / 100
        t.tokens[s.symbol] = new BigNumber(t.tokens[s.symbol] || 0).plus(s.amount).toFixed()
        days.set(day, t)
    }
    return [...days.values()].sort((a, b) => b.day.localeCompare(a.day))
}

/** the paid till sales as CSV: one line each */
export function tillCsv(sales: TillSale[], headers: string[]): string {
    const cell = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    const lines = sales.filter(s => s.paid && s.fiat !== undefined)
        .sort((a, b) => a.paid!.at - b.paid!.at)
        .map(s => [new Date(s.paid!.at).toISOString(), String(s.fiat), s.currency || '', s.amount, s.symbol, s.paid!.from, s.paid!.txId])
    return [headers, ...lines].map(l => l.map(cell).join(',')).join('\n')
}
