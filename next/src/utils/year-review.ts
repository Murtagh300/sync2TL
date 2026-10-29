import type { Flow } from './overview'

/**
 * A year on VeChain in a few numbers, for a card to share: how many transactions, on how many days,
 * the busiest month, what came in and went out of the main tokens, and what X2Earn apps paid.
 * Moves between the user's own addresses don't count. Nothing here names a counterparty: the card
 * is meant to be shared.
 */

export type YearStats = {
    year: number
    transactions: number
    activeDays: number
    /** 0..11, null without activity */
    busiestMonth: number | null
    /** distinct addresses paid or paid by */
    people: number
    /** per token contract (VET: the zero address) */
    totals: Record<string, { in: bigint, out: bigint }>
    /** X2Earn rewards: count and B3TR (wei) */
    rewards: { count: number, amount: bigint }
}

export function yearStats(year: number, list: Flow[], own: string[], rewards: { amount: bigint, time: number }[] = []): YearStats {
    const mine = new Set(own.map(a => a.toLowerCase()))
    const start = new Date(year, 0, 1).getTime()
    const end = new Date(year + 1, 0, 1).getTime()
    const inYear = list.filter(f => f.time >= start && f.time < end && !mine.has(f.counterparty.toLowerCase()))
    const txs = new Set<string>()
    const days = new Set<string>()
    const months = new Array<number>(12).fill(0)
    const people = new Set<string>()
    const totals: YearStats['totals'] = {}
    for (const f of inYear) {
        if (!txs.has(f.txId)) {
            txs.add(f.txId)
            const d = new Date(f.time)
            months[d.getMonth()]!++
            days.add(`${d.getMonth()}-${d.getDate()}`)
        }
        people.add(f.counterparty.toLowerCase())
        const t = totals[f.token] || (totals[f.token] = { in: 0n, out: 0n })
        if (f.dir === 'in') t.in += f.amount
        else t.out += f.amount
    }
    const top = Math.max(...months)
    const r = rewards.filter(x => x.time >= start && x.time < end)
    return {
        year,
        transactions: txs.size,
        activeDays: days.size,
        busiestMonth: top > 0 ? months.indexOf(top) : null,
        people: people.size,
        totals,
        rewards: { count: r.length, amount: r.reduce((s, x) => s + x.amount, 0n) }
    }
}
