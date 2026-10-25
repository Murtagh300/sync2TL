/** searching and narrowing the activity list: words, direction, period, token */

export type ActivityFilter = {
    q: string
    kind: 'all' | 'in' | 'out' | 'fail'
    period: 'all' | 'month' | '30d' | 'year'
    /** the token's address ('' is VET); null: any */
    token: string | null
}

export const emptyFilter = (): ActivityFilter => ({ q: '', kind: 'all', period: 'all', token: null })

type Filterable = {
    time: number
    title: string
    tone: 'in' | 'out' | 'neutral' | 'fail'
    amount?: string
    counterparty?: string
    note?: string
    txId?: string
    asset?: { token: string }
}

export function periodStart(period: ActivityFilter['period'], now = new Date()): number {
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    if (period === '30d') return now.getTime() - 30 * 24 * 3600 * 1000
    if (period === 'year') return new Date(now.getFullYear(), 0, 1).getTime()
    return 0
}

/**
 * rows that match: every word of the search in the title, amount, note, address or
 * transaction id (names too, through nameOf)
 */
export function filterRows<T extends Filterable>(rows: T[], f: ActivityFilter, nameOf: (a: string) => string = () => '', now = new Date()): T[] {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    const from = periodStart(f.period, now)
    return rows.filter(r => {
        if (f.kind !== 'all' && r.tone !== f.kind) return false
        if (r.time < from) return false
        if (f.token !== null && (r.asset?.token || '').toLowerCase() !== f.token.toLowerCase()) return false
        if (!words.length) return true
        const hay = [r.title, r.amount, r.note, r.counterparty, r.counterparty ? nameOf(r.counterparty) : '', r.txId]
            .filter(Boolean).join(' ').toLowerCase()
        return words.every(w => hay.includes(w))
    })
}

export const isFiltered = (f: ActivityFilter) => !!f.q.trim() || f.kind !== 'all' || f.period !== 'all' || f.token !== null
