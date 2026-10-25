import type { BalanceChanges } from './simulate'

/**
 * A spending limit: a transaction that sends more than this (in the chosen currency) asks
 * for a moment's thought first. The value comes from the dry run's balance changes.
 */

export const LIMIT_OPTIONS = [0, 100, 500, 1000, 5000]

const ZERO = '0x0000000000000000000000000000000000000000'

/**
 * what leaves the wallet, in fiat: VET and tokens that go down in the dry run, at their
 * price; tokens without a price count as nothing (they can't be valued)
 */
export function outgoingValue(
    changes: BalanceChanges,
    priceUsd: Record<string, number>,
    decimals: (token: string) => number,
    fx: number
): number {
    let usd = 0
    if (changes.vet < 0n) {
        usd += Number(-changes.vet) / 1e18 * (priceUsd[ZERO] || 0)
    }
    for (const [token, delta] of Object.entries(changes.tokens)) {
        if (delta < 0n) {
            usd += Number(-delta) / 10 ** decimals(token) * (priceUsd[token.toLowerCase()] || 0)
        }
    }
    return usd * fx
}
