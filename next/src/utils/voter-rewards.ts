import { abi } from 'thor-devkit'
import { fn } from './actions'
import { read, X_ALLOCATION_VOTING } from './ecosystem'

/**
 * B3TR for voting in VeBetterDAO's weekly allocation rounds: VoterRewards keeps what each voter
 * earned per round (and a Galaxy Member bonus) until it is claimed; claiming pays the voter, and
 * anyone may send the claim. A round can be claimed once it has ended. Contract from the VeBetterDAO
 * repository, checked on chain (it names XAllocationVoting back).
 */

export const VOTER_REWARDS = '0x838a33af756a6366f93e201423e1425f67ec0fa7'
/** rounds looked back at; unclaimed rewards older than this are rare (rounds are a week) */
export const LOOKBACK = 12

const view = (name: string) => new abi.Function({
    type: 'function', name, constant: true, payable: false, stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'cycle' }, { type: 'address', name: 'voter' }], outputs: [{ type: 'uint256', name: 'reward' }]
})

export const vr = {
    getReward: view('getReward'),
    getGMReward: view('getGMReward'),
    claimReward: fn('claimReward', [['uint256', 'cycle'], ['address', 'voter']]),
    currentRoundId: new abi.Function({ type: 'function', name: 'currentRoundId', constant: true, payable: false, stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256', name: 'round' }] })
}

export type VoterReward = { round: number, address: string, amount: bigint }

/** the ended rounds to look at, newest first */
export function roundsToCheck(current: number, lookback = LOOKBACK): number[] {
    const out: number[] = []
    for (let r = current - 1; r >= 1 && r >= current - lookback; r--) out.push(r)
    return out
}

/** unclaimed rewards (voting and Galaxy Member together) of these addresses in ended rounds */
export async function unclaimedRewards(thor: Connex.Thor, addresses: string[], lookback = LOOKBACK): Promise<{ round: number, rewards: VoterReward[] }> {
    const [cur] = await read(thor, [{ to: X_ALLOCATION_VOTING, f: vr.currentRoundId, args: [] }])
    const round = Number(cur?.round || 0)
    const rounds = roundsToCheck(round, lookback)
    const calls = addresses.flatMap(address => rounds.flatMap(r => [
        { to: VOTER_REWARDS, f: vr.getReward, args: [r, address] },
        { to: VOTER_REWARDS, f: vr.getGMReward, args: [r, address] }
    ]))
    const out: VoterReward[] = []
    for (let i = 0; i < calls.length; i += 60) {
        const chunk = calls.slice(i, i + 60)
        const res = await read(thor, chunk)
        for (let k = 0; k < chunk.length; k += 2) {
            const amount = BigInt(String(res[k]?.reward || 0)) + BigInt(String(res[k + 1]?.reward || 0))
            if (amount > 0n) out.push({ round: Number(chunk[k]!.args[0]), address: String(chunk[k]!.args[1]).toLowerCase(), amount })
        }
    }
    return { round, rewards: out.sort((a, b) => b.round - a.round) }
}

/** one claim per round; a transaction holds them all */
export function claimClauses(rewards: VoterReward[]): { to: string, value: string, data: string }[] {
    return rewards.map(r => ({ to: VOTER_REWARDS, value: '0', data: vr.claimReward.encode(r.round, r.address) }))
}
