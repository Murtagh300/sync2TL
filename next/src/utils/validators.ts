import { abi } from 'thor-devkit'
import { fn } from './actions'
import { read, STARGATE } from './ecosystem'

/**
 * Validators since Hayabusa (VeChain's staking, the Staker built-in contract): who is active,
 * how much is delegated to each, whether it is online, and what its delegators earned in its last
 * completed period. StarGate NFTs delegate to one of them (Stargate.delegate).
 *
 * The earnings figure is an estimate from the last completed period: the VTHO paid to its
 * delegators, per 10,000 VET they delegated, per week.
 */

export const STAKER = '0x00000000000000000000000000005374616b6572'
const ZERO = '0x0000000000000000000000000000000000000000'
const ONLINE = 4294967295

const view = (name: string, inputs: abi.Function.Parameter[], outputs: abi.Function.Parameter[]) =>
    new abi.Function({ type: 'function', name, constant: true, payable: false, stateMutability: 'view', inputs, outputs })
const a = (name: string): abi.Function.Parameter => ({ type: 'address', name })
const u = (name: string, bits = 256): abi.Function.Parameter => ({ type: `uint${bits}`, name })

export const staker = {
    firstActive: view('firstActive', [], [a('first')]),
    firstQueued: view('firstQueued', [], [a('first')]),
    next: view('next', [a('prev')], [a('nextValidation')]),
    getValidation: view('getValidation', [a('validator')], [a('endorser'), u('stake'), u('weight'), u('queuedVET'), u('status', 8), u('offlineBlock', 32)]),
    getValidationPeriodDetails: view('getValidationPeriodDetails', [a('validator')], [u('period', 32), u('startBlock', 32), u('exitBlock', 32), u('completedPeriods', 32)]),
    getValidationTotals: view('getValidationTotals', [a('validator')], [u('lockedVET'), u('lockedWeight'), u('queuedVET'), u('exitingVET'), u('nextPeriodWeight')]),
    getDelegatorsRewards: view('getDelegatorsRewards', [a('validator'), u('stakingPeriod', 32)], [u('rewards')])
}

export const sgDelegation = {
    getDelegationDetails: view('getDelegationDetails', [u('tokenId')], [
        u('delegationId'), a('validator'), u('stake'), u('probabilityMultiplier', 8), u('startPeriod', 32), u('endPeriod', 32), { type: 'bool', name: 'isLocked' }, u('status', 8)
    ]),
    hasRequestedExit: view('hasRequestedExit', [u('tokenId')], [{ type: 'bool', name: 'requested' }]),
    delegate: fn('delegate', [['uint256', 'tokenId'], ['address', 'validator']]),
    requestDelegationExit: fn('requestDelegationExit', [['uint256', 'tokenId']])
}

export type Validator = {
    address: string
    status: 'queued' | 'active'
    online: boolean
    /** the validator's own stake and what delegators put in (VET, whole) */
    own: number
    delegated: number
    /** periods completed: how long it has run */
    periods: number
    /** blocks per period */
    period: number
    /** VTHO per week per 10,000 delegated VET, last period (null: no completed period yet) */
    perWeek: number | null
}

const E18 = 1e18

/**
 * what a validator's delegators earned on average, per 10,000 VET they delegated, per week; how
 * much one NFT gets also depends on its level's multiplier
 */
export function perWeek(rewards: number, delegated: number, periodBlocks: number): number | null {
    if (!(rewards > 0) || !(delegated > 0) || !(periodBlocks > 0)) return null
    const weekBlocks = 7 * 24 * 360
    return rewards / delegated * 10000 * (weekBlocks / periodBlocks)
}

const CACHE = 'bv-validators'
const TTL = 30 * 60 * 1000

/** every active and queued validator; kept half an hour, the walk takes a moment */
export async function listValidators(thor: Connex.Thor, force = false): Promise<Validator[]> {
    if (!force) {
        try {
            const c = JSON.parse(localStorage.getItem(CACHE) || 'null') as { at: number, list: Validator[] } | null
            if (c && Date.now() - c.at < TTL) return c.list
        } catch { }
    }
    const addresses: { address: string, status: Validator['status'] }[] = []
    for (const [first, status] of [[staker.firstActive, 'active'], [staker.firstQueued, 'queued']] as const) {
        let [d] = await read(thor, [{ to: STAKER, f: first, args: [] }])
        let v = String(d?.first || ZERO).toLowerCase()
        // the list is a chain: each validator names the next
        for (let i = 0; i < 500 && v !== ZERO; i++) {
            addresses.push({ address: v, status })
            ;[d] = await read(thor, [{ to: STAKER, f: staker.next, args: [v] }])
            v = String(d?.nextValidation || ZERO).toLowerCase()
        }
    }
    const list: Validator[] = []
    for (let i = 0; i < addresses.length; i += 20) {
        const chunk = addresses.slice(i, i + 20)
        const out = await read(thor, chunk.flatMap(x => [
            { to: STAKER, f: staker.getValidation, args: [x.address] },
            { to: STAKER, f: staker.getValidationPeriodDetails, args: [x.address] },
            { to: STAKER, f: staker.getValidationTotals, args: [x.address] }
        ]))
        const periods = chunk.map((_, k) => Number(out[k * 3 + 1]?.completedPeriods || 0))
        const rewards = await read(thor, chunk.map((x, k) => ({ to: STAKER, f: staker.getDelegatorsRewards, args: [x.address, Math.max(1, periods[k]!)] })))
        chunk.forEach((x, k) => {
            const val = out[k * 3]
            const per = out[k * 3 + 1]
            const tot = out[k * 3 + 2]
            const own = Number(val?.stake || 0) / E18
            const locked = Number(tot?.lockedVET || 0) / E18
            const period = Number(per?.period || 0)
            list.push({
                address: x.address,
                status: x.status,
                online: Number(val?.offlineBlock ?? ONLINE) === ONLINE,
                own,
                delegated: Math.max(0, locked - own),
                periods: periods[k]!,
                period,
                perWeek: periods[k] ? perWeek(Number(rewards[k]?.rewards || 0) / E18, Math.max(0, locked - own), period) : null
            })
        })
    }
    try {
        localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), list }))
    } catch { }
    return list
}

export type TokenDelegation = { tokenId: string, validator: string, status: number, exitRequested: boolean }

/** which validator each StarGate NFT is with */
export async function delegationsOf(thor: Connex.Thor, tokenIds: string[]): Promise<TokenDelegation[]> {
    const out = await read(thor, tokenIds.flatMap(id => [
        { to: STARGATE, f: sgDelegation.getDelegationDetails, args: [id] },
        { to: STARGATE, f: sgDelegation.hasRequestedExit, args: [id] }
    ]))
    return tokenIds.map((tokenId, k) => {
        const d = out[k * 2]
        return {
            tokenId,
            validator: String(d?.validator || ZERO).toLowerCase(),
            status: Number(d?.status || 0),
            exitRequested: !!out[k * 2 + 1]?.requested
        }
    })
}

/**
 * what moving an NFT to a validator takes: one delegate call when it isn't working for one yet (or
 * is still waiting), else first an exit at the end of the current period
 */
export function moveClauses(d: TokenDelegation, to: string): { kind: 'delegate' | 'exit' | 'wait', clauses: { to: string, value: string, data: string }[] } {
    // statuses: 0 none, 1 pending, 2 active, 3 exited
    if (d.status === 2) {
        if (d.exitRequested) return { kind: 'wait', clauses: [] }
        return { kind: 'exit', clauses: [{ to: STARGATE, value: '0', data: sgDelegation.requestDelegationExit.encode(d.tokenId) }] }
    }
    return { kind: 'delegate', clauses: [{ to: STARGATE, value: '0', data: sgDelegation.delegate.encode(d.tokenId, to) }] }
}
