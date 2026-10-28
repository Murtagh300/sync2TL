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

/**
 * A buy you want to make: again and again (every week, "€25 of B3TR"), or once the price comes
 * down to a level. The server never holds keys, so BlackVault reminds you (in the app, and by push
 * when the BlackVault server's push is on) and opens the swap filled in; you sign it.
 */
export type ScheduledBuy = {
    id: string
    walletId: number
    addressIndex: number
    /** what you pay with and what you buy, by symbol; the amount is in `from` */
    from: string
    to: string
    amount: string
    every: 'day' | 'week' | 'month' | null
    /** a limit buy: when one `to` costs this much or less (in the currency) */
    below: number | null
    currency: 'EUR' | 'USD'
    /** when the next one is due (repeating buys) */
    next: number
    /** a limit buy that fired: it waits until opened */
    fired?: boolean
}

const KEY = 'bv-payments'

type Store = { requests: PaymentRequestRecord[], scheduled: ScheduledPayment[], buys: ScheduledBuy[] }

function load(): Store {
    try {
        return { requests: [], scheduled: [], buys: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Store> }
    } catch {
        return { requests: [], scheduled: [], buys: [] }
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

/** the next due date after a payment or a buy */
export function advance(s: { every: 'day' | 'week' | 'month' | null, next: number }, from = Date.now()) {
    const d = new Date(Math.max(s.next, from))
    if (s.every === 'day') {
        d.setDate(d.getDate() + 1)
    } else if (s.every === 'week') {
        d.setDate(d.getDate() + 7)
    } else {
        d.setMonth(d.getMonth() + 1)
    }
    s.next = d.getTime()
}

/** repeating buys that are due */
export function dueBuys(now = Date.now()): ScheduledBuy[] {
    return payments.buys.filter(b => b.every && b.next <= now)
}

/** limit buys whose price is reached: price(symbol) is one token in the buy's currency, or 0 */
export function reachedLimits(price: (symbol: string, currency: 'EUR' | 'USD') => number): ScheduledBuy[] {
    return payments.buys.filter(b => {
        if (b.below === null || b.fired) return false
        const p = price(b.to, b.currency)
        return p > 0 && p <= b.below
    })
}

/** the swap a buy opens, filled in */
export function buyRoute(b: ScheduledBuy) {
    return { name: 'swap', query: { wid: String(b.walletId), i: String(b.addressIndex), from: b.from, to: b.to, amt: b.amount, buy: b.id } }
}

/** a buy's swap was opened: the next one, or a limit buy is done */
export function buyOpened(id: string) {
    const b = payments.buys.find(x => x.id === id)
    if (!b) return
    if (b.every) {
        advance(b)
    } else {
        payments.buys = payments.buys.filter(x => x.id !== id)
    }
}

export function dueScheduled(now = Date.now()): ScheduledPayment[] {
    return payments.scheduled.filter(s => s.next <= now)
}
