/**
 * Risk labels before signing, as Rabby and Phantom show them: how old the contract is, whether this
 * wallet has used it before, tokens sent to a contract that can't give them back, and a transaction
 * that only takes. The per-action risks (unlimited approvals, approval for all NFTs) stay with the
 * actions (describe-action.ts); these are about the contracts and the whole transaction.
 */
import { abi, Transaction } from 'thor-devkit'
import { fns } from './actions'
import type { BalanceChanges } from './simulate'

export type RiskLevel = 'info' | 'warn' | 'danger'
export type RiskLabel = { level: RiskLevel, key: string, params?: Record<string, string | number> }

/** a contract this young is a reason to look twice; younger still, a reason to stop */
export const YOUNG_DAYS = 30
export const NEW_DAYS = 3

const BLOCK_SECONDS = 10

type Clause = { to: string | null, value: string | number, data?: string }

export type RiskInput = {
    clauses: Clause[]
    changes: BalanceChanges | null
    /** what the wallet ships with or knows: tokens, collections, markets, routers */
    known: (address: string) => boolean
    /** a token contract (VET or tokens sent there are lost) */
    isToken: (address: string) => boolean
    /** the contracts among the clauses' targets, with their age in days (null: unknown) */
    contracts: Record<string, number | null>
    /** contracts this wallet sent a transaction to before */
    used: Set<string>
}

const lower = (a: string | null | undefined) => (a || '').toLowerCase()

/** the recipient of an ERC-20 transfer clause, if it is one */
function transferRecipient(c: Clause): string | null {
    const data = lower(c.data)
    if (!data.startsWith(fns.transfer.signature) || data.length < 10 + 64 * 2) return null
    try {
        return lower(abi.decodeParameters(fns.transfer.definition.inputs, '0x' + data.slice(10)).to as string)
    } catch {
        return null
    }
}

export function riskLabels(input: RiskInput): RiskLabel[] {
    const out: RiskLabel[] = []
    const seen = new Set<string>()
    for (const c of input.clauses) {
        const to = lower(c.to)
        if (!to) continue

        // VET to a token contract, or a token to a token contract: gone for good
        const recipient = transferRecipient(c)
        if ((BigInt(c.value || 0) > 0n && input.isToken(to)) || (recipient && input.isToken(recipient))) {
            out.push({ level: 'danger', key: 'to_token_contract' })
        }

        if (seen.has(to) || !(to in input.contracts) || input.known(to)) continue
        seen.add(to)
        const days = input.contracts[to]
        if (days !== null && days !== undefined && days < NEW_DAYS) {
            out.push({ level: 'danger', key: 'new_contract', params: { days: Math.max(0, Math.floor(days)) } })
        } else if (days !== null && days !== undefined && days < YOUNG_DAYS) {
            out.push({ level: 'warn', key: 'young_contract', params: { days: Math.floor(days) } })
        }
        if (!input.used.has(to)) {
            out.push({ level: 'info', key: 'first_contract' })
        }
    }

    // several things leave and nothing comes back: how drainers look
    const ch = input.changes
    if (ch) {
        const outs = (ch.vet < 0n ? 1 : 0) + Object.values(ch.tokens).filter(v => v < 0n).length + ch.nfts.filter(n => n.direction === 'out').length
        const ins = (ch.vet > 0n ? 1 : 0) + Object.values(ch.tokens).filter(v => v > 0n).length + ch.nfts.filter(n => n.direction === 'in').length
        if (outs >= 3 && ins === 0) {
            out.push({ level: 'warn', key: 'only_out', params: { n: outs } })
        }
    }
    // one "first time" line is enough
    const firsts = out.filter(l => l.key === 'first_contract')
    return [...out.filter(l => l.key !== 'first_contract'), ...firsts.slice(0, 1)]
        .sort((a, b) => rank(b.level) - rank(a.level))
}

const rank = (l: RiskLevel) => l === 'danger' ? 2 : l === 'warn' ? 1 : 0

// ---- the chain side --------------------------------------------------------------------

const AGE_KEY = 'bv-contract-born'

function loadBorn(): Record<string, number> {
    try {
        return JSON.parse(localStorage.getItem(AGE_KEY) || '{}') as Record<string, number>
    } catch {
        return {}
    }
}

/**
 * The block a contract first had code, by a search over the node's history: eight probes a round,
 * about eight rounds. Kept, since it never changes.
 */
export async function contractBornAt(nodeUrl: string, address: string, head: number): Promise<number | null> {
    const a = lower(address)
    const born = loadBorn()
    if (born[a] !== undefined) return born[a]!
    const hasCode = async (n: number) => {
        const r = await fetch(`${nodeUrl.replace(/\/$/, '')}/accounts/${a}?revision=${n}`)
        if (!r.ok) throw new Error(`node ${r.status}`)
        return !!((await r.json()) as { hasCode?: boolean }).hasCode
    }
    // lo has no code, hi has it
    let lo = 0
    let hi = head
    if (!(await hasCode(hi))) return null
    while (hi - lo > 1) {
        const step = (hi - lo) / 8
        const probes = Array.from({ length: 7 }, (_, i) => Math.floor(lo + step * (i + 1))).filter((n, i, all) => n > lo && n < hi && all.indexOf(n) === i)
        if (probes.length === 0) break
        const res = await Promise.all(probes.map(hasCode))
        const first = res.indexOf(true)
        if (first === -1) {
            lo = probes[probes.length - 1]!
        } else {
            hi = probes[first]!
            if (first > 0) lo = probes[first - 1]!
        }
    }
    born[a] = hi
    try {
        localStorage.setItem(AGE_KEY, JSON.stringify(born))
    } catch { }
    return hi
}

export function ageInDays(bornAt: number, head: number): number {
    return (head - bornAt) * BLOCK_SECONDS / 86400
}

/** contracts this wallet's past transactions went to (from the activity list) */
export function usedContracts(activities: M.Activity[], signer: string): Set<string> {
    const used = new Set<string>()
    for (const a of activities) {
        if (a.type !== 'tx') continue
        const g = a.glob as { encoded?: string, signer?: string }
        if (!g.encoded || lower(g.signer) !== lower(signer)) continue
        try {
            const tx = Transaction.decode(Buffer.from(g.encoded.replace(/^0x/, ''), 'hex'))
            for (const c of tx.body.clauses) if (c.to) used.add(lower(c.to))
        } catch {
            // an unreadable record says nothing
        }
    }
    return used
}
