import { reactive, watch } from 'vue'
import { address as addr } from 'thor-devkit'
import { fn, fns } from './actions'
import { toWei } from './format'

/**
 * Subscriptions without a contract of our own, with the token standard alone:
 * - the subscriber pays the first period and allows the seller to take up to 12 more
 *   (approve), in one transaction; cancelling sets that allowance to 0;
 * - the seller sees who allowed them (the token's Approval events), when each last paid
 *   (Transfer events), and collects every one that is due in one transaction (transferFrom).
 * Tokens only: VET has no allowance. One plan per token per seller, so an allowance says
 * which plan it is for.
 */

export type Every = 'week' | 'month'
export const PERIODS = 12

export type Plan = { id: string, name: string, to: string, symbol: string, token: string, decimals: number, amount: string, every: Every }

/** a subscription this wallet pays */
export type Subscription = Plan & { from: string, gid: string, startedAt: number, cancelled?: boolean }

type Store = { plans: Plan[], subscriptions: Subscription[] }
const KEY = 'bv-subscriptions'

function load(): Store {
    try {
        return { plans: [], subscriptions: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Store> }
    } catch {
        return { plans: [], subscriptions: [] }
    }
}

export const subs = reactive<Store>(load())

watch(subs, v => {
    try {
        localStorage.setItem(KEY, JSON.stringify(v))
    } catch { }
}, { deep: true })

/** the link a seller shares: opening it in BlackVault shows the plan to subscribe to */
export function planLink(p: Plan, base = window.location.origin + window.location.pathname): string {
    const q = new URLSearchParams({ to: addr.toChecksumed(p.to), amount: p.amount, symbol: p.symbol, every: p.every, name: p.name })
    return `${base}#/subscribe?${q.toString()}`
}

export function periodMs(every: Every): number {
    return (every === 'week' ? 7 : 30) * 86400 * 1000
}

type Clause = { to: string, value: string, data: string }

/** subscribing: the first period now, and an allowance for the next ones */
export function subscribeClauses(p: { to: string, token: string }, wei: bigint): Clause[] {
    return [
        { to: p.token, value: '0', data: fns.approve.encode(p.to, (wei * BigInt(PERIODS)).toString()) },
        { to: p.token, value: '0', data: fns.transfer.encode(p.to, wei.toString()) }
    ]
}

export function cancelClause(p: { to: string, token: string }): Clause {
    return { to: p.token, value: '0', data: fns.approve.encode(p.to, '0') }
}

// ---- the seller's side ---------------------------------------------------------------------

const APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const balanceOf = fn('balanceOf', [['address', 'owner']], [['uint256', 'balance']])
const pad = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0')
const topicAddress = (t: string) => '0x' + t.slice(-40).toLowerCase()

export type Subscriber = {
    address: string
    /** what the seller may still take (wei) */
    allowance: bigint
    balance: bigint
    /** the last payment to the seller in this token (ms); 0 when none */
    lastPaid: number
    due: boolean
    /** due, allowed and covered: collect it */
    collectable: boolean
}

/** whether a subscriber is due, from the last payment and the period */
export function isDue(lastPaid: number, every: Every, now = Date.now()): boolean {
    // a day early is fine: payments drift a little each period
    return now - lastPaid >= periodMs(every) - 86400 * 1000
}

export async function findSubscribers(thor: Connex.Thor, plan: Plan, now = Date.now()): Promise<Subscriber[]> {
    const me = plan.to.toLowerCase()
    const token = plan.token.toLowerCase()
    const approvals = await thor.filter('event', [{ address: token, topic0: APPROVAL, topic2: pad(me) }]).order('desc').apply(0, 256)
    const owners = [...new Set(approvals.map(e => topicAddress(e.topics[1]!)))]
    const wei = planWei(plan)
    const out: Subscriber[] = []
    for (let i = 0; i < owners.length; i += 20) {
        await Promise.all(owners.slice(i, i + 20).map(async owner => {
            const [allowanceOut, balanceOut] = await thor.explain([
                { to: token, value: 0, data: fns.allowance.encode(owner, me) },
                { to: token, value: 0, data: balanceOf.encode(owner) }
            ]).execute()
            const allowance = allowanceOut && !allowanceOut.reverted ? BigInt(fns.allowance.decode(allowanceOut.data).amount) : 0n
            // cancelled: nothing more to take
            if (allowance === 0n) return
            const balance = balanceOut && !balanceOut.reverted ? BigInt(balanceOf.decode(balanceOut.data).balance) : 0n
            const [last] = await thor.filter('event', [{ address: token, topic0: TRANSFER, topic1: pad(owner), topic2: pad(me) }]).order('desc').apply(0, 1)
            const lastPaid = last ? last.meta.blockTimestamp * 1000 : 0
            const due = isDue(lastPaid, plan.every, now)
            out.push({ address: owner, allowance, balance, lastPaid, due, collectable: due && allowance >= wei && balance >= wei })
        }))
    }
    return out.sort((a, b) => Number(b.collectable) - Number(a.collectable) || b.lastPaid - a.lastPaid)
}

/** a plan's amount in the token's smallest unit */
export function planWei(p: { amount: string, decimals: number }): bigint {
    return BigInt(toWei(p.amount, p.decimals))
}

export function collectClauses(plan: Plan, subscribers: Subscriber[], wei: bigint): Clause[] {
    return subscribers.filter(s => s.collectable).map(s => ({
        to: plan.token,
        value: '0',
        data: fns.transferFrom.encode(s.address, plan.to, wei.toString())
    }))
}
