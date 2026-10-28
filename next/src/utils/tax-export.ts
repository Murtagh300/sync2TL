/**
 * A year of transfers for tax software, in Koinly's universal CSV (CoinTracking, Blockpit and most
 * others read it too): one row per transaction, a swap as one trade row, VTHO fees on the first row.
 * Tokens the wallet doesn't know (mostly airdropped spam) are left out.
 */
import type { Flow } from './overview'
import { X2EARN_REWARDS_POOL } from './x2earn'

export const KOINLY_HEADERS = ['Date', 'Sent Amount', 'Sent Currency', 'Received Amount', 'Received Currency',
    'Fee Amount', 'Fee Currency', 'Net Worth Amount', 'Net Worth Currency', 'Label', 'Description', 'TxHash']

/** an amount in whole units with a dot, no grouping: what importers read */
export function plainDecimal(amount: bigint, decimals: number): string {
    const neg = amount < 0n
    const v = neg ? -amount : amount
    const base = 10n ** BigInt(decimals)
    const int = v / base
    const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '')
    return `${neg ? '-' : ''}${int}${frac ? '.' + frac : ''}`
}

/** "2026-10-28 09:21:14 UTC" */
export function koinlyDate(ms: number): string {
    return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
}

type Leg = { token: string, amount: bigint }

export function koinlyRows(
    list: Flow[],
    token: (address: string) => { symbol: string, decimals: number } | undefined,
    /** VTHO paid per transaction (wei), for the ones this wallet paid */
    fees: Map<string, bigint>
): string[][] {
    const byTx = new Map<string, Flow[]>()
    for (const f of list) byTx.set(f.txId, [...(byTx.get(f.txId) || []), f])

    const rows: string[][] = []
    for (const [txId, flows] of byTx) {
        // per token, what went out and what came in
        const net = new Map<string, bigint>()
        for (const f of flows) {
            if (!token(f.token)) continue
            net.set(f.token, (net.get(f.token) || 0n) + (f.dir === 'in' ? f.amount : -f.amount))
        }
        const outs: Leg[] = [...net].filter(([, v]) => v < 0n).map(([t, v]) => ({ token: t, amount: -v }))
        const ins: Leg[] = [...net].filter(([, v]) => v > 0n).map(([t, v]) => ({ token: t, amount: v }))
        if (!outs.length && !ins.length) continue

        const time = koinlyDate(flows[0]!.time)
        const fmt = (l: Leg) => [plainDecimal(l.amount, token(l.token)!.decimals), token(l.token)!.symbol]
        const fee = fees.get(txId)
        let first = true
        const counterparty = flows.find(f => token(f.token))?.counterparty || ''
        // B3TR from VeBetterDAO's rewards pool: income, as Koinly labels it
        const reward = counterparty === X2EARN_REWARDS_POOL
        const push = (sent: Leg | null, received: Leg | null, description: string) => {
            const feeCells = first && fee ? [plainDecimal(fee, 18), 'VTHO'] : ['', '']
            first = false
            const label = reward && received && !sent ? 'reward' : ''
            rows.push([time, ...(sent ? fmt(sent) : ['', '']), ...(received ? fmt(received) : ['', '']), ...feeCells, '', '', label,
                label ? 'VeBetterDAO X2Earn' : description, txId])
        }
        if (outs.length === 1 && ins.length === 1) {
            // a swap or a buy: one trade
            push(outs[0]!, ins[0]!, '')
        } else {
            for (const o of outs) push(o, null, ins.length ? '' : `to ${counterparty}`)
            for (const i of ins) push(null, i, outs.length ? '' : `from ${counterparty}`)
        }
    }
    return rows.sort((a, b) => a[0]!.localeCompare(b[0]!))
}
