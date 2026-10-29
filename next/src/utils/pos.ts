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
