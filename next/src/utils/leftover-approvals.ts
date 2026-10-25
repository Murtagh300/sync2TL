import { abi, Transaction } from 'thor-devkit'
import { fns } from './actions'

/**
 * After a purchase or swap, an approval the transaction gave may not be used up: the
 * contract can still spend the rest. Those are offered for revoking right away.
 * Collection-wide NFT approvals (setApprovalForAll) are left alone: a listing needs them.
 */

export type Leftover = { token: string, spender: string, allowance: bigint }

/** the token approvals (approve with an amount) among a transaction's clauses */
export function approvalsIn(encoded: string): { token: string, spender: string }[] {
    try {
        const raw = Buffer.from(encoded.replace(/^0x/, ''), 'hex')
        // signed as the activity keeps it; unsigned decodes too
        let tx: ReturnType<typeof Transaction.decode>
        try {
            tx = Transaction.decode(raw)
        } catch {
            tx = Transaction.decode(raw, true)
        }
        const out: { token: string, spender: string }[] = []
        for (const c of tx.body.clauses) {
            const data = (c.data || '').toLowerCase()
            if (!c.to || !data.startsWith(fns.approve.signature)) {
                continue
            }
            const d = abi.decodeParameters(fns.approve.definition.inputs, '0x' + data.slice(10))
            if (BigInt(d.amount) > 0n) {
                out.push({ token: c.to.toLowerCase(), spender: String(d.spender).toLowerCase() })
            }
        }
        return out
    } catch {
        return []
    }
}

/** what is still approved after the transaction; NFT contracts (no allowance()) drop out */
export async function leftoverApprovals(thor: Connex.Thor, encoded: string, owner: string): Promise<Leftover[]> {
    const approvals = approvalsIn(encoded)
    if (!approvals.length) {
        return []
    }
    const outputs = await thor.explain(approvals.map(a => ({ to: a.token, value: 0, data: fns.allowance.encode(owner, a.spender) }))).execute()
    const out: Leftover[] = []
    approvals.forEach((a, i) => {
        const o = outputs[i]
        if (!o || o.reverted || o.data.length < 66) {
            return
        }
        const allowance = BigInt(o.data.slice(0, 66))
        if (allowance > 0n) {
            out.push({ ...a, allowance })
        }
    })
    return out
}
