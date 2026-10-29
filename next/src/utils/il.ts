import { abi } from 'thor-devkit'

/**
 * A liquidity position against holding: what the tokens put in would be worth now, next to what
 * the position is worth now, both at the pool's current price. The difference is impermanent loss
 * plus the fees earned (V2 pools add fees to the position; for V3, fees not yet collected aren't
 * counted, so it's the loss alone).
 *
 * What went in comes from the chain, at the average cost of what's still in:
 * - V2: each mint of LP tokens to the owner, with the pool's Mint in the same transaction; each
 *   burn takes its share of what went in;
 * - V3: the position's IncreaseLiquidity and DecreaseLiquidity events.
 */

export type Leg = { kind: 'add' | 'remove', units: bigint, amount0: bigint, amount1: bigint }

/** what's still in, at average cost: removing a share of the units removes that share of each amount */
export function costBasis(legs: Leg[]): { units: bigint, amount0: bigint, amount1: bigint } {
    let units = 0n
    let a0 = 0n
    let a1 = 0n
    for (const l of legs) {
        if (l.kind === 'add') {
            units += l.units
            a0 += l.amount0
            a1 += l.amount1
        } else if (units > 0n) {
            const take = l.units > units ? units : l.units
            a0 -= a0 * take / units
            a1 -= a1 * take / units
            units -= take
        }
    }
    return { units, amount0: a0, amount1: a1 }
}

/** the position against holding, in %: positive is better than holding */
export function vsHodl(now: { a0: number, a1: number }, hodl: { a0: number, a1: number }, price0in1: number): number | null {
    const v = now.a0 * price0in1 + now.a1
    const h = hodl.a0 * price0in1 + hodl.a1
    if (!(h > 0) || !Number.isFinite(v)) return null
    return (v / h - 1) * 100
}

// ---- reading the chain -----------------------------------------------------------------------

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ZERO = '0x' + '0'.repeat(64)
const pad = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0')

const MINT = new abi.Event({ type: 'event', name: 'Mint', anonymous: false, inputs: [
    { indexed: true, type: 'address', name: 'sender' }, { indexed: false, type: 'uint256', name: 'amount0' }, { indexed: false, type: 'uint256', name: 'amount1' }
] })
const BURN = new abi.Event({ type: 'event', name: 'Burn', anonymous: false, inputs: [
    { indexed: true, type: 'address', name: 'sender' }, { indexed: false, type: 'uint256', name: 'amount0' }, { indexed: false, type: 'uint256', name: 'amount1' },
    { indexed: true, type: 'address', name: 'to' }
] })
const LIQ = (name: string) => new abi.Event({ type: 'event', name, anonymous: false, inputs: [
    { indexed: true, type: 'uint256', name: 'tokenId' }, { indexed: false, type: 'uint128', name: 'liquidity' },
    { indexed: false, type: 'uint256', name: 'amount0' }, { indexed: false, type: 'uint256', name: 'amount1' }
] })
const INCREASE = LIQ('IncreaseLiquidity')
const DECREASE = LIQ('DecreaseLiquidity')

/** V2: what the owner put in that is still in the pool; null when LP tokens came or went another way */
export async function v2Basis(thor: Connex.Thor, pool: string, owner: string, balance: bigint) {
    const p = pool.toLowerCase()
    const [mints, sent] = await Promise.all([
        thor.filter('event', [{ address: p, topic0: TRANSFER, topic1: ZERO, topic2: pad(owner) }]).order('asc').apply(0, 256),
        thor.filter('event', [{ address: p, topic0: TRANSFER, topic1: pad(owner), topic2: pad(p) }]).order('asc').apply(0, 256)
    ])
    const moves = [
        ...mints.map(e => ({ e, kind: 'add' as const })),
        ...sent.map(e => ({ e, kind: 'remove' as const }))
    ].sort((a, b) => a.e.meta.blockNumber - b.e.meta.blockNumber || a.e.meta.clauseIndex - b.e.meta.clauseIndex)
    const legs: Leg[] = []
    for (const { e, kind } of moves) {
        const receipt = await thor.transaction(e.meta.txID).getReceipt()
        const out = receipt?.outputs[e.meta.clauseIndex]
        const ev = out?.events.find(x => x.address.toLowerCase() === p && x.topics[0] === (kind === 'add' ? MINT : BURN).signature)
        if (!ev) return null
        const d = (kind === 'add' ? MINT : BURN).decode(ev.data, ev.topics)
        legs.push({ kind, units: BigInt(e.data), amount0: BigInt(d.amount0), amount1: BigInt(d.amount1) })
    }
    const basis = costBasis(legs)
    // held LP tokens that weren't minted here (bought, or moved in): no basis to compare with
    return basis.units === balance ? basis : null
}

/** V3: what went into a position and is still in it */
export async function v3Basis(thor: Connex.Thor, manager: string, tokenId: string) {
    const topic1 = '0x' + BigInt(tokenId).toString(16).padStart(64, '0')
    const events = await thor.filter('event', [
        { address: manager.toLowerCase(), topic0: INCREASE.signature, topic1 },
        { address: manager.toLowerCase(), topic0: DECREASE.signature, topic1 }
    ]).order('asc').apply(0, 200)
    const legs: Leg[] = events.map(e => {
        const add = e.topics[0] === INCREASE.signature
        const d = (add ? INCREASE : DECREASE).decode(e.data, e.topics)
        return { kind: add ? 'add' : 'remove', units: BigInt(d.liquidity), amount0: BigInt(d.amount0), amount1: BigInt(d.amount1) }
    })
    return costBasis(legs)
}
