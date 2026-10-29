import { abi } from 'thor-devkit'
import { fn, fns } from './actions'

/**
 * VeChain's own programs, read from mainnet:
 * - StarGate: VET staked in a node NFT, delegated to a validator; rewards in VTHO.
 *   Contracts from docs.stargate.vechain.org, checked on chain (each names the other).
 * - VeBetterDAO: B3TR, and VOT3 (B3TR converted one to one, for voting) per allocation round.
 *   Contracts from the VeBetterDAO repository, checked on chain.
 */

export const STARGATE = '0x03c557be98123fdb6fad325328ac6eb77de7248c'
export const STARGATE_NFT = '0x1856c533ac2d94340aaa8544d35a5c1d4a21dee7'
export const B3TR = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
export const VOT3 = '0x76ca782b59c74d088c7d2cce2f211bc00836c602'
export const X_ALLOCATION_VOTING = '0x89a00bb0947a30ff95beef77a66aede3842fe5b7'

const view = (name: string, inputs: abi.Function.Parameter[], outputs: abi.Function.Parameter[]) =>
    new abi.Function({ type: 'function', name, constant: true, payable: false, stateMutability: 'view', inputs, outputs })

const LEVEL = { type: 'tuple', name: 'level', components: [
    { type: 'string', name: 'name' }, { type: 'bool', name: 'isX' }, { type: 'uint8', name: 'id' },
    { type: 'uint64', name: 'maturityBlocks' }, { type: 'uint64', name: 'scaledRewardFactor' }, { type: 'uint256', name: 'vetAmountRequiredToStake' }
] } as abi.Function.Parameter
const TOKEN = { type: 'tuple', name: 'token', components: [
    { type: 'uint256', name: 'tokenId' }, { type: 'uint8', name: 'levelId' }, { type: 'uint64', name: 'mintedAtBlock' },
    { type: 'uint256', name: 'vetAmountStaked' }, { type: 'uint48', name: 'lastVetGeneratedVthoClaimTimestamp_deprecated' }
] } as abi.Function.Parameter

export const sg = {
    idsOwnedBy: view('idsOwnedBy', [{ type: 'address', name: 'owner' }], [{ type: 'uint256[]', name: 'ids' }]),
    getToken: view('getToken', [{ type: 'uint256', name: 'tokenId' }], [TOKEN]),
    getLevels: view('getLevels', [], [{ ...LEVEL, type: 'tuple[]', name: 'levels' } as abi.Function.Parameter]),
    maturityPeriodEndBlock: view('maturityPeriodEndBlock', [{ type: 'uint256', name: 'tokenId' }], [{ type: 'uint64', name: 'block' }]),
    claimableRewards: view('claimableRewards', [{ type: 'uint256', name: 'tokenId' }], [{ type: 'uint256', name: 'amount' }]),
    getDelegationStatus: view('getDelegationStatus', [{ type: 'uint256', name: 'tokenId' }], [{ type: 'uint8', name: 'status' }]),
    claimRewards: fn('claimRewards', [['uint256', 'tokenId']]),
    getLevelSupply: view('getLevelSupply', [{ type: 'uint8', name: 'levelId' }], [{ type: 'uint256', name: 'circulating' }, { type: 'uint256', name: 'cap' }]),
    // checked with dry runs on mainnet: stake mints the NFT (and returns its id), unstake burns it
    // and pays the VET back once it isn't delegated
    stake: fn('stake', [['uint8', 'levelId']], [['uint256', 'tokenId']], true),
    unstake: fn('unstake', [['uint256', 'tokenId']])
}

export type StakeLevel = { id: number, name: string, vet: bigint, maturityDays: number, minted: number, cap: number }

/** the levels a new NFT can be staked at (not the X levels, which only came from old nodes) */
export async function stakeLevels(thor: Connex.Thor): Promise<StakeLevel[]> {
    const [d] = await read(thor, [{ to: STARGATE_NFT, f: sg.getLevels, args: [] }])
    const levels = ((d?.levels || []) as { id: string, name: string, isX: boolean, maturityBlocks: string, vetAmountRequiredToStake: string }[])
        .filter(l => !l.isX)
    const supply = await read(thor, levels.map(l => ({ to: STARGATE_NFT, f: sg.getLevelSupply, args: [l.id] })))
    return levels.map((l, i) => ({
        id: Number(l.id),
        name: l.name,
        vet: BigInt(l.vetAmountRequiredToStake),
        maturityDays: Math.round(Number(l.maturityBlocks) * 10 / 86400),
        minted: Number(supply[i]?.circulating || 0),
        cap: Number(supply[i]?.cap || 0)
    })).sort((a, b) => (a.vet < b.vet ? -1 : 1))
}

/** staking pays exactly the level's VET */
export function stakeClause(level: StakeLevel): { to: string, value: string, data: string } {
    return { to: STARGATE, value: level.vet.toString(), data: sg.stake.encode(level.id) }
}

/** an NFT can be unstaked when it isn't working for a validator (none, or exited) */
export function canUnstake(p: { status: DelegationStatus }): boolean {
    return p.status === 'none' || p.status === 'exited'
}

export type DelegationStatus = 'none' | 'pending' | 'active' | 'exited'
const STATUS: DelegationStatus[] = ['none', 'pending', 'active', 'exited']

export type StakePosition = {
    tokenId: string
    level: string
    staked: bigint
    claimable: bigint
    status: DelegationStatus
    /** the block the maturity period ends (0: matured) */
    maturityEndBlock: number
}

/** run view calls in one dry run; null for a reverted one */
export async function read(thor: Connex.Thor, calls: { to: string, f: abi.Function, args: unknown[] }[]): Promise<(abi.Decoded | null)[]> {
    if (!calls.length) return []
    const out = await thor.explain(calls.map(c => ({ to: c.to, value: 0, data: c.f.encode(...c.args) }))).execute()
    return calls.map((c, i) => {
        const o = out[i]
        if (!o || o.reverted) return null
        try {
            return c.f.decode(o.data)
        } catch {
            return null
        }
    })
}

let levelNames: Promise<Record<number, string>> | null = null

export async function stakePositions(thor: Connex.Thor, owner: string): Promise<StakePosition[]> {
    levelNames = levelNames || read(thor, [{ to: STARGATE_NFT, f: sg.getLevels, args: [] }]).then(([d]) => {
        const levels = (d?.levels || []) as { id: string, name: string }[]
        return Object.fromEntries(levels.map(l => [Number(l.id), l.name]))
    }).catch(() => { levelNames = null; return {} })
    const [ids] = await read(thor, [{ to: STARGATE_NFT, f: sg.idsOwnedBy, args: [owner] }])
    const list = ((ids?.ids || []) as string[]).map(String)
    if (!list.length) return []
    const names = await levelNames
    const details = await read(thor, list.flatMap(id => [
        { to: STARGATE_NFT, f: sg.getToken, args: [id] },
        { to: STARGATE, f: sg.claimableRewards, args: [id] },
        { to: STARGATE, f: sg.getDelegationStatus, args: [id] },
        { to: STARGATE_NFT, f: sg.maturityPeriodEndBlock, args: [id] }
    ]))
    return list.map((tokenId, k) => {
        const [token, rewards, status, maturity] = details.slice(k * 4, k * 4 + 4)
        const t = token?.token as { levelId: string, vetAmountStaked: string } | undefined
        return {
            tokenId,
            level: t ? names[Number(t.levelId)] || `#${t.levelId}` : '',
            staked: BigInt(t?.vetAmountStaked || 0),
            claimable: BigInt(rewards?.amount || 0),
            status: STATUS[Number(status?.status ?? 0)] || 'none',
            maturityEndBlock: Number(maturity?.block || 0)
        }
    })
}

export const vb = {
    balanceOf: view('balanceOf', [{ type: 'address', name: 'owner' }], [{ type: 'uint256', name: 'balance' }]),
    unlockedBalance: view('unlockedBalance', [{ type: 'address', name: 'account' }], [{ type: 'uint256', name: 'balance' }]),
    currentRoundId: view('currentRoundId', [], [{ type: 'uint256', name: 'round' }]),
    currentRoundDeadline: view('currentRoundDeadline', [], [{ type: 'uint256', name: 'block' }]),
    hasVoted: view('hasVoted', [{ type: 'uint256', name: 'roundId' }, { type: 'address', name: 'user' }], [{ type: 'bool', name: 'voted' }]),
    convertToVOT3: fn('convertToVOT3', [['uint256', 'amount']]),
    convertToB3TR: fn('convertToB3TR', [['uint256', 'amount']])
}

export type VeBetterInfo = { b3tr: bigint, vot3: bigint, unlocked: bigint, round: number, deadlineBlock: number, voted: boolean }

export async function veBetterInfo(thor: Connex.Thor, address: string): Promise<VeBetterInfo> {
    const [b3tr, vot3, unlocked, round, deadline] = await read(thor, [
        { to: B3TR, f: vb.balanceOf, args: [address] },
        { to: VOT3, f: vb.balanceOf, args: [address] },
        { to: VOT3, f: vb.unlockedBalance, args: [address] },
        { to: X_ALLOCATION_VOTING, f: vb.currentRoundId, args: [] },
        { to: X_ALLOCATION_VOTING, f: vb.currentRoundDeadline, args: [] }
    ])
    const roundId = Number(round?.round || 0)
    const [voted] = roundId ? await read(thor, [{ to: X_ALLOCATION_VOTING, f: vb.hasVoted, args: [roundId, address] }]) : [null]
    return {
        b3tr: BigInt(b3tr?.balance || 0),
        vot3: BigInt(vot3?.balance || 0),
        unlocked: BigInt(unlocked?.balance ?? vot3?.balance ?? 0),
        round: roundId,
        deadlineBlock: Number(deadline?.block || 0),
        voted: !!voted?.voted
    }
}

/** B3TR → VOT3 needs VOT3 to take the B3TR (an approval of exactly the amount); back is one call */
export function convertClauses(direction: 'toVOT3' | 'toB3TR', amount: bigint): { to: string, value: string, data: string }[] {
    if (direction === 'toVOT3') {
        return [
            { to: B3TR, value: '0', data: fns.approve.encode(VOT3, amount.toString()) },
            { to: VOT3, value: '0', data: vb.convertToVOT3.encode(amount.toString()) }
        ]
    }
    return [{ to: VOT3, value: '0', data: vb.convertToB3TR.encode(amount.toString()) }]
}

/** a block number as a time, at ten seconds a block */
export function blockTime(block: number, headNumber: number, headTimestamp: number): number {
    return (headTimestamp + (block - headNumber) * 10) * 1000
}
