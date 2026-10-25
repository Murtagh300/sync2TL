/**
 * The sites (dApps) this wallet signed for, from the activity: when, how often, what.
 */
export type DappUse = {
    host: string
    origin: string
    count: number
    last: number
    txs: number
    certs: number
    activityIds: number[]
}

export function dappsFromActivity(list: M.Activity[]): DappUse[] {
    const by = new Map<string, DappUse>()
    for (const a of list) {
        const origin = a.glob.origin
        if (!origin) continue
        let host: string
        let base: string
        try {
            host = new URL(origin).host
            base = new URL(origin).origin
        } catch {
            continue
        }
        const d = by.get(host) || { host, origin: base, count: 0, last: 0, txs: 0, certs: 0, activityIds: [] }
        d.count++
        d.last = Math.max(d.last, a.createdTime)
        a.type === 'tx' ? d.txs++ : d.certs++
        d.activityIds.push(a.id)
        by.set(host, d)
    }
    return [...by.values()].sort((a, b) => b.last - a.last)
}
