import { abi } from 'thor-devkit'
import { fn } from './actions'
import { read } from './ecosystem'
import { ipfsUrl } from './x2earn'

/**
 * VeBetterDAO's governance (B3TRGovernor): proposals to change the DAO, voted with VOT3 held at the
 * proposal's snapshot. A proposal's text lives on IPFS (title, short description, the full text).
 * Address from the VeBetterDAO contracts repository, checked on chain.
 */

export const GOVERNOR = '0x1c65c25fabe2fc1bcb82f253fa0c916a322f777c'

const view = (name: string, inputs: abi.Function.Parameter[], outputs: abi.Function.Parameter[]) =>
    new abi.Function({ type: 'function', name, constant: true, payable: false, stateMutability: 'view', inputs, outputs })
const id = { type: 'uint256', name: 'proposalId' }
const n = (name: string) => ({ type: 'uint256', name })

const g = {
    state: view('state', [id], [{ type: 'uint8', name: 'state' }]),
    proposalVotes: view('proposalVotes', [id], [n('againstVotes'), n('forVotes'), n('abstainVotes')]),
    proposalSnapshot: view('proposalSnapshot', [id], [n('block')]),
    proposalDeadline: view('proposalDeadline', [id], [n('block')]),
    hasVoted: view('hasVoted', [id, { type: 'address', name: 'account' }], [{ type: 'bool', name: 'voted' }]),
    getVotes: view('getVotes', [{ type: 'address', name: 'account' }, n('timepoint')], [n('votes')]),
    castVoteWithReason: fn('castVoteWithReason', [['uint256', 'proposalId'], ['uint8', 'support'], ['string', 'reason']])
}

const CREATED = new abi.Event({
    type: 'event', name: 'ProposalCreated', anonymous: false,
    inputs: [
        { indexed: true, type: 'uint256', name: 'proposalId' }, { indexed: true, type: 'address', name: 'proposer' },
        { indexed: false, type: 'address[]', name: 'targets' }, { indexed: false, type: 'uint256[]', name: 'values' },
        { indexed: false, type: 'string[]', name: 'signatures' }, { indexed: false, type: 'bytes[]', name: 'calldatas' },
        { indexed: false, type: 'string', name: 'description' }, { indexed: true, type: 'uint256', name: 'roundIdVoteStart' },
        { indexed: false, type: 'uint256', name: 'depositThreshold' }
    ]
})

export const STATES = ['pending', 'active', 'canceled', 'defeated', 'succeeded', 'queued', 'executed', 'deposit', 'development', 'completed'] as const
export type ProposalState = typeof STATES[number]

/** the support values of a vote, as the governor counts them */
export const SUPPORT = { against: 0, for: 1, abstain: 2 } as const
export type Support = keyof typeof SUPPORT

export type Proposal = {
    id: string
    title: string
    summary: string
    state: ProposalState
    /** VOT3, whole */
    votes: { against: number, for: number, abstain: number }
    snapshot: number
    deadline: number
    createdAt: number
}

type Meta = { title?: string, shortDescription?: string }

async function meta(cid: string): Promise<Meta> {
    const url = ipfsUrl(cid)
    if (!url) return {}
    try {
        const r = await fetch(url)
        if (!r.ok) return {}
        const m = await r.json() as Meta
        return { title: String(m.title || '').slice(0, 200), shortDescription: String(m.shortDescription || '').slice(0, 800) }
    } catch {
        return {}
    }
}

/** the latest proposals, newest first */
export async function latestProposals(thor: Connex.Thor, count = 12): Promise<Proposal[]> {
    const logs = await thor.filter('event', [{ address: GOVERNOR, topic0: CREATED.signature }]).order('desc').apply(0, count)
    const created = logs.map(l => {
        const d = CREATED.decode(l.data, l.topics)
        return { id: String(d.proposalId), description: String(d.description || ''), time: l.meta.blockTimestamp * 1000 }
    })
    const out = await read(thor, created.flatMap(c => [
        { to: GOVERNOR, f: g.state, args: [c.id] },
        { to: GOVERNOR, f: g.proposalVotes, args: [c.id] },
        { to: GOVERNOR, f: g.proposalSnapshot, args: [c.id] },
        { to: GOVERNOR, f: g.proposalDeadline, args: [c.id] }
    ]))
    const metas = await Promise.all(created.map(c => meta(c.description)))
    const whole = (v: unknown) => Number(BigInt(String(v || '0')) / 10n ** 18n)
    return created.map((c, k) => {
        const [st, votes, snap, dead] = out.slice(k * 4, k * 4 + 4)
        return {
            id: c.id,
            title: metas[k]!.title || `#${c.id.slice(0, 8)}…`,
            summary: metas[k]!.shortDescription || '',
            state: STATES[Number(st?.state ?? 0)] || 'pending',
            votes: { against: whole(votes?.againstVotes), for: whole(votes?.forVotes), abstain: whole(votes?.abstainVotes) },
            snapshot: Number(snap?.block || 0),
            deadline: Number(dead?.block || 0),
            createdAt: c.time
        }
    })
}

/** an address's vote on each proposal, and its voting power at each snapshot (VOT3 wei) */
export async function myStanding(thor: Connex.Thor, address: string, proposals: Proposal[]): Promise<Record<string, { voted: boolean, power: bigint }>> {
    const out = await read(thor, proposals.flatMap(p => [
        { to: GOVERNOR, f: g.hasVoted, args: [p.id, address] },
        { to: GOVERNOR, f: g.getVotes, args: [address, p.snapshot] }
    ]))
    return Object.fromEntries(proposals.map((p, k) => [p.id, {
        voted: !!out[k * 2]?.voted,
        power: BigInt(String(out[k * 2 + 1]?.votes || '0'))
    }]))
}

export function proposalVoteClause(proposalId: string, support: Support, reason = ''): { to: string, value: string, data: string } {
    return { to: GOVERNOR, value: '0', data: g.castVoteWithReason.encode(proposalId, SUPPORT[support], reason.slice(0, 280)) }
}
