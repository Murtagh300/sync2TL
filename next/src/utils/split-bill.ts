import { BigNumber } from 'bignumber.js'

/**
 * Splitting a bill: the total over the people, each share a payment request. Shares differ in
 * the last decimal (0.0001, 0.0002…) so the wallet can tell who paid, as a request is
 * recognised by its exact amount.
 */
export function splitShares(total: string, people: number): string[] {
    const t = new BigNumber(total)
    if (!t.isFinite() || t.lte(0) || people < 2) return []
    const base = t.div(people).decimalPlaces(2, BigNumber.ROUND_UP)
    return Array.from({ length: people }, (_, k) => base.plus(new BigNumber(k + 1).times('0.0001')).toFixed())
}
