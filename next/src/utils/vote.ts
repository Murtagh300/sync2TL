import { abi } from 'thor-devkit'
import { read, X_ALLOCATION_VOTING } from './ecosystem'

/**
 * Voting in VeBetterDAO's allocation round from the wallet: VOT3 held at the round's start
 * (its snapshot) is the voting power, shared over one or more apps in one castVote.
 * VeBetterDAO only counts people: an address without a VePassport is refused, which a dry
 * run tells before anything is signed.
 */

const view = (name: string, inputs: abi.Function.Parameter[], outputs: abi.Function.Parameter[]) =>
    new abi.Function({ type: 'function', name, constant: true, payable: false, stateMutability: 'view', inputs, outputs })

const f = {
    roundSnapshot: view('roundSnapshot', [{ type: 'uint256', name: 'roundId' }], [{ type: 'uint256', name: 'block' }]),
    getVotes: view('getVotes', [{ type: 'address', name: 'account' }, { type: 'uint256', name: 'timepoint' }], [{ type: 'uint256', name: 'votes' }]),
    getAppIdsOfRound: view('getAppIdsOfRound', [{ type: 'uint256', name: 'roundId' }], [{ type: 'bytes32[]', name: 'ids' }]),
    votingThreshold: view('votingThreshold', [], [{ type: 'uint256', name: 'threshold' }]),
    isActive: view('isActive', [{ type: 'uint256', name: 'roundId' }], [{ type: 'bool', name: 'active' }]),
    castVote: new abi.Function({
        type: 'function', name: 'castVote', constant: false, payable: false, stateMutability: 'nonpayable',
        inputs: [{ type: 'uint256', name: 'roundId' }, { type: 'bytes32[]', name: 'appIds' }, { type: 'uint256[]', name: 'voteWeights' }],
        outputs: []
    })
}

export type RoundState = {
    round: number
    active: boolean
    /** VOT3 (wei) this address can vote with in this round */
    power: bigint
    /** the least a vote must use in all (wei) */
    threshold: bigint
    /** the apps that can get votes in this round (lower case) */
    appIds: string[]
}

export async function roundState(thor: Connex.Thor, address: string, round: number): Promise<RoundState> {
    const [snap, ids, threshold, active] = await read(thor, [
        { to: X_ALLOCATION_VOTING, f: f.roundSnapshot, args: [round] },
        { to: X_ALLOCATION_VOTING, f: f.getAppIdsOfRound, args: [round] },
        { to: X_ALLOCATION_VOTING, f: f.votingThreshold, args: [] },
        { to: X_ALLOCATION_VOTING, f: f.isActive, args: [round] }
    ])
    const [votes] = snap ? await read(thor, [{ to: X_ALLOCATION_VOTING, f: f.getVotes, args: [address, snap.block] }]) : [null]
    return {
        round,
        active: !!active?.active,
        power: BigInt(String(votes?.votes || 0)),
        threshold: BigInt(String(threshold?.threshold || 0)),
        appIds: ((ids?.ids || []) as string[]).map(i => i.toLowerCase())
    }
}

/** the voting power split by shares (any positive numbers); what rounding leaves goes to the first */
export function splitWeights(total: bigint, shares: number[]): bigint[] {
    const sum = shares.reduce((a, b) => a + Math.max(0, b), 0)
    if (!sum || total <= 0n) return shares.map(() => 0n)
    // shares in millionths keep it in whole numbers
    const parts = shares.map(s => total * BigInt(Math.round(Math.max(0, s) / sum * 1e6)) / 1000000n)
    const rest = total - parts.reduce((a, b) => a + b, 0n)
    if (parts.length) parts[0] = parts[0]! + rest
    return parts
}

export function voteClause(round: number, votes: { id: string, weight: bigint }[]): { to: string, value: string, data: string } {
    const used = votes.filter(v => v.weight > 0n)
    return {
        to: X_ALLOCATION_VOTING,
        value: '0',
        data: f.castVote.encode(round, used.map(v => v.id), used.map(v => v.weight.toString()))
    }
}

/** the revert reason of a dry run ("User does not meet the criteria to be considered a person") */
export function revertReason(data: string | undefined): string {
    // Error(string): selector, offset, length, text
    if (!data || !data.startsWith('0x08c379a0')) return ''
    try {
        return String(abi.decodeParameter('string', '0x' + data.slice(10)))
    } catch {
        return ''
    }
}

/** why castVote would fail, from a dry run: 'person', 'voted', other text, or '' when it goes through */
export async function voteProblem(thor: Connex.Thor, address: string, clause: { to: string, value: string, data: string }): Promise<string> {
    const [out] = await thor.explain([clause]).caller(address).execute()
    if (!out?.reverted) return ''
    const reason = revertReason(out.data)
    if (/person/i.test(reason)) return 'person'
    if (/already voted/i.test(reason)) return 'voted'
    return reason || 'unknown'
}
