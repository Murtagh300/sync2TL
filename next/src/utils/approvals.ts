import { fns } from './actions'

/**
 * The approvals an address has given: token allowances (ERC-20 Approval) and
 * collection-wide NFT access (ApprovalForAll), found in its logs and checked against
 * the current state, so revoked and spent ones drop out.
 */

const APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
const APPROVAL_FOR_ALL = '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31'

export type Approval =
    | { kind: 'token', contract: string, spender: string, allowance: bigint }
    | { kind: 'nft', contract: string, spender: string }

const PAGE = 256
const MAX_LOGS = 4096
const BATCH = 40

const pad = (address: string) => '0x' + address.slice(2).toLowerCase().padStart(64, '0')
const addressOf = (topic: string) => '0x' + topic.slice(-40).toLowerCase()

export async function findApprovals(thor: Connex.Thor, owner: string): Promise<Approval[]> {
    const filter = thor.filter('event', [
        { topic0: APPROVAL, topic1: pad(owner) },
        { topic0: APPROVAL_FOR_ALL, topic1: pad(owner) }
    ]).order('desc')

    // newest first: the first log of a pair is its latest state
    const seen = new Set<string>()
    const candidates: Approval[] = []
    for (let offset = 0; offset < MAX_LOGS; offset += PAGE) {
        const logs = await filter.apply(offset, PAGE)
        for (const log of logs) {
            const contract = log.address.toLowerCase()
            if (log.topics[0] === APPROVAL_FOR_ALL && log.topics.length === 3) {
                const key = `nft:${contract}:${addressOf(log.topics[2]!)}`
                if (!seen.has(key)) {
                    seen.add(key)
                    candidates.push({ kind: 'nft', contract, spender: addressOf(log.topics[2]!) })
                }
            } else if (log.topics[0] === APPROVAL && log.topics.length === 3) {
                // three topics: ERC-20; ERC-721 approvals of a single token have four and end with a transfer
                const key = `token:${contract}:${addressOf(log.topics[2]!)}`
                if (!seen.has(key)) {
                    seen.add(key)
                    candidates.push({ kind: 'token', contract, spender: addressOf(log.topics[2]!), allowance: 0n })
                }
            }
        }
        if (logs.length < PAGE) {
            break
        }
    }

    // keep the ones still in force
    const live: Approval[] = []
    for (let start = 0; start < candidates.length;) {
        const batch = candidates.slice(start, start + BATCH)
        const outputs = await thor.explain(batch.map(a => ({
            to: a.contract,
            value: 0,
            data: a.kind === 'token' ? fns.allowance.encode(owner, a.spender) : fns.isApprovedForAll.encode(owner, a.spender)
        }))).execute()
        let done = 0
        for (const [i, o] of outputs.entries()) {
            done = i + 1
            if (o.reverted) {
                break
            }
            const a = batch[i]!
            try {
                const value = BigInt(o.data && o.data !== '0x' ? o.data : '0x0')
                if (value > 0n) {
                    live.push(a.kind === 'token' ? { ...a, allowance: value } : a)
                }
            } catch {
                // not a standard answer: skip
            }
        }
        start += Math.max(done, 1)
    }
    return live
}

/** the clause that revokes an approval */
export function revokeClause(a: Approval): { to: string, value: string, data: string } {
    return {
        to: a.contract,
        value: '0',
        data: a.kind === 'token' ? fns.approve.encode(a.spender, 0) : fns.setApprovalForAll.encode(a.spender, false)
    }
}
