/**
 * Since Hayabusa (VeChain's staking upgrade) plain VET makes no VTHO; it comes from VET staked in
 * StarGate and delegated to a validator. This reckons what an address's StarGate NFTs bring in per
 * week (from their validators' last completed period, utils/validators.ts) against what the address
 * spends on fees, and so how many transactions a month that pays for and when the tank runs dry.
 */

/** VTHO a week from delegated NFTs: per 10,000 VET at each NFT's validator */
export function weeklyIncome(nfts: { staked: number, perWeek: number | null }[]): number {
    return nfts.reduce((s, n) => s + (n.perWeek ? n.perWeek * n.staked / 10000 : 0), 0)
}

/** VTHO this address paid for itself in fees over the last days, per day */
export function dailySpend(activities: M.Activity[], address: string, days = 30, now = Date.now()): number {
    const a = address.toLowerCase()
    const since = now - days * 86400 * 1000
    let total = 0
    for (const x of activities) {
        if (x.type !== 'tx' || x.createdTime < since) continue
        const r = x.glob.receipt
        if (!r || x.glob.signer.toLowerCase() !== a || r.gasPayer.toLowerCase() !== a) continue
        total += Number(BigInt(r.paid)) / 1e18
    }
    return total / days
}

export type Forecast = {
    weekly: number
    /** transactions a month the income pays for */
    txPerMonth: number
    /** days until the balance is gone at this pace; null when income keeps up */
    daysLeft: number | null
}

export function forecast(vtho: number, weekly: number, perDay: number, fee: number): Forecast {
    const net = perDay - weekly / 7
    return {
        weekly,
        txPerMonth: fee > 0 ? Math.floor(weekly * 30 / 7 / fee) : 0,
        daysLeft: net > 0 ? Math.floor(vtho / net) : null
    }
}
