import { reactive, watch } from 'vue'
import { abi } from 'thor-devkit'
import { BigNumber } from 'bignumber.js'

/**
 * Payments put aside to send together: VeChain carries several clauses in one transaction, so a
 * queue of payments from one address is signed once and costs one base fee. Kept on this device.
 */

export type QueuedPayment = {
    id: string
    gid: string
    /** the paying address (lowercase) */
    from: string
    to: string
    symbol: string
    /** the token contract; '' for VET */
    token: string
    decimals: number
    amount: string
    added: number
}

const KEY = 'bv-send-queue'
/** a transaction carries this many payments at most here, to stay well inside the gas limit */
export const MAX_QUEUE = 40

function load(): QueuedPayment[] {
    try {
        const list = JSON.parse(localStorage.getItem(KEY) || '[]') as QueuedPayment[]
        return Array.isArray(list) ? list : []
    } catch {
        return []
    }
}

export const sendQueue = reactive({ items: load() })

watch(() => sendQueue.items, v => {
    try {
        localStorage.setItem(KEY, JSON.stringify(v))
    } catch { }
}, { deep: true })

/** the queued payments of one address */
export function queueOf(gid: string, from: string): QueuedPayment[] {
    const f = from.toLowerCase()
    return sendQueue.items.filter(p => p.gid === gid && p.from === f)
}

/** adds a payment; false when that address's queue is full */
export function enqueue(p: Omit<QueuedPayment, 'id' | 'added' | 'from'> & { from: string }, now = Date.now()): boolean {
    const from = p.from.toLowerCase()
    if (queueOf(p.gid, from).length >= MAX_QUEUE) return false
    sendQueue.items.push({ ...p, from, id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, added: now })
    return true
}

export function dequeue(ids: string[]) {
    const drop = new Set(ids)
    sendQueue.items = sendQueue.items.filter(p => !drop.has(p.id))
}

const transfer = new abi.Function({
    type: 'function', name: 'transfer', constant: false, payable: false, stateMutability: 'nonpayable',
    inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool', name: 'ok' }]
})

const wei = (amount: string, decimals: number) => new BigNumber(amount).shiftedBy(decimals).integerValue(BigNumber.ROUND_DOWN).toFixed(0)

/** one clause per payment, in the order they were queued */
export function queueClauses(items: QueuedPayment[]): { to: string, value: string, data: string, comment: string }[] {
    return items.map(p => p.token
        ? { to: p.token, value: '0', data: transfer.encode(p.to, wei(p.amount, p.decimals)), comment: `${p.amount} ${p.symbol} → ${p.to}` }
        : { to: p.to, value: wei(p.amount, p.decimals), data: '0x', comment: `${p.amount} VET → ${p.to}` })
}

/** what the queue moves, per token: { VET: 30, B3TR: 12.5 } */
export function queueTotals(items: QueuedPayment[]): Record<string, string> {
    const out: Record<string, BigNumber> = {}
    for (const p of items) out[p.symbol] = (out[p.symbol] || new BigNumber(0)).plus(p.amount)
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.toFormat()]))
}
