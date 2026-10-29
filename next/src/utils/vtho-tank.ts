/**
 * VTHO as a fuel tank: how many transactions an address can still pay for, from what its own
 * recent transactions cost, and the part above what you want to keep, which can go to VET.
 */

/** a transaction's fee when the address has none of its own yet (VTHO) */
export const DEFAULT_FEE = 0.5
/** the tank is low below this many transactions */
export const LOW_TX = 5

/** the average fee (VTHO) of an address's last transactions it paid for itself */
export function averageFee(activities: M.Activity[], address: string, last = 20): number {
    const a = address.toLowerCase()
    const fees: { at: number, fee: number }[] = []
    for (const x of activities) {
        if (x.type !== 'tx') continue
        const r = x.glob.receipt
        if (!r || x.glob.signer.toLowerCase() !== a || r.gasPayer.toLowerCase() !== a) continue
        const fee = Number(BigInt(r.paid)) / 1e18
        if (fee > 0) fees.push({ at: x.createdTime, fee })
    }
    const recent = fees.sort((x, y) => y.at - x.at).slice(0, last).map(x => x.fee)
    return recent.length ? recent.reduce((s, f) => s + f, 0) / recent.length : DEFAULT_FEE
}

/** whole transactions the balance still pays for */
export function txLeft(vtho: number, fee: number): number {
    return fee > 0 ? Math.floor(vtho / fee) : 0
}

/** VTHO above what to keep, worth swapping (at least 10) */
export function surplus(vtho: number, keep: number): number {
    const s = vtho - Math.max(0, keep)
    return s >= 10 ? Math.floor(s) : 0
}
