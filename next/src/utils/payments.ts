import { reactive, watch } from 'vue'
import { BigNumber } from 'bignumber.js'
import type { Incoming } from './incoming'

/**
 * Payment requests you sent (and whether they were paid), and payments you make on a
 * schedule (BlackVault reminds you and fills in the form). Kept on this device.
 */

export type PaymentRequestRecord = {
    id: string
    gid: string
    /** your address that should receive it */
    to: string
    amount: string
    symbol: string
    /** the token contract; '' for VET */
    token: string
    decimals: number
    note: string
    createdAt: number
    paid?: { txId: string, from: string, at: number }
}

export type ScheduledPayment = {
    id: string
    walletId: number
    addressIndex: number
    to: string
    amount: string
    symbol: string
    note: string
    every: 'week' | 'month'
    /** when the next one is due */
    next: number
}

const KEY = 'bv-payments'

type Store = { requests: PaymentRequestRecord[], scheduled: ScheduledPayment[] }

function load(): Store {
    try {
        return { requests: [], scheduled: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Store> }
    } catch {
        return { requests: [], scheduled: [] }
    }
}

export const payments = reactive<Store>(load())

watch(payments, v => {
    try {
        localStorage.setItem(KEY, JSON.stringify(v))
    } catch { }
}, { deep: true })

export const newId = () => Math.random().toString(36).slice(2, 10)

/** mark open requests paid when an incoming transfer of the exact amount arrived after them */
export function matchPaidRequests(incoming: (Incoming & { gid: string })[]): PaymentRequestRecord[] {
    const newlyPaid: PaymentRequestRecord[] = []
    // one payment settles one request: requests with the same amount each need their own
    const used = new Set(payments.requests.filter(r => r.paid).map(r => r.paid!.txId.toLowerCase()))
    // oldest requests first, so payments settle them in the order they were asked
    for (const r of [...payments.requests].sort((a, b) => a.createdAt - b.createdAt)) {
        if (r.paid) continue
        const wei = new BigNumber(r.amount).times(new BigNumber(10).pow(r.decimals)).toFixed(0)
        const hit = incoming.find(i =>
            !used.has(i.txId.toLowerCase()) &&
            i.gid === r.gid &&
            i.to === r.to.toLowerCase() &&
            i.time >= r.createdAt - 60 * 1000 &&
            (r.token ? i.kind === 'token' && i.contract === r.token.toLowerCase() : i.kind === 'vet') &&
            i.amount === wei)
        if (hit) {
            used.add(hit.txId.toLowerCase())
            r.paid = { txId: hit.txId, from: hit.from, at: hit.time }
            newlyPaid.push(r)
        }
    }
    return newlyPaid
}

/** the next due date after a payment */
export function advance(s: ScheduledPayment, from = Date.now()) {
    const d = new Date(Math.max(s.next, from))
    if (s.every === 'week') {
        d.setDate(d.getDate() + 7)
    } else {
        d.setMonth(d.getMonth() + 1)
    }
    s.next = d.getTime()
}

export function dueScheduled(now = Date.now()): ScheduledPayment[] {
    return payments.scheduled.filter(s => s.next <= now)
}
