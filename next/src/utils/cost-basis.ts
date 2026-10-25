import type { Flow } from './overview'

/**
 * What tokens cost, from the chain: a transaction that sends VET (or VVET) and brings a
 * token in is a buy, the other way round a sale. Costs are in VET, by average cost: a sale
 * takes the average cost of what is held. Tokens that came in without VET going out
 * (a gift, an airdrop, a reward) have no known cost and are counted apart.
 */

export const VVET = '0x45429a2255e7248e57fce99e7239aed3f84b7a53'
const ZERO = '0x0000000000000000000000000000000000000000'
const isVet = (t: string) => t === ZERO || t === VVET

export type TokenCost = {
    token: string
    /** held with a known cost, and that cost (VET) */
    qty: number
    cost: number
    /** profit or loss on what was sold (VET) */
    realized: number
    /** came in without a price */
    unknown: number
    buys: number
    sells: number
}

/** amounts in whole tokens: decimals per token (18 when unknown) */
export function costBasis(flows: Flow[], decimals: (token: string) => number = () => 18): TokenCost[] {
    const byTx = new Map<string, Flow[]>()
    for (const f of [...flows].sort((a, b) => a.time - b.time)) {
        byTx.set(f.txId, [...(byTx.get(f.txId) || []), f])
    }
    const book = new Map<string, TokenCost>()
    const entry = (token: string) => {
        let e = book.get(token)
        if (!e) book.set(token, e = { token, qty: 0, cost: 0, realized: 0, unknown: 0, buys: 0, sells: 0 })
        return e
    }
    const units = (f: Flow) => Number(f.amount) / 10 ** decimals(f.token)
    for (const list of byTx.values()) {
        const vetIn = list.filter(f => f.dir === 'in' && isVet(f.token)).reduce((s, f) => s + units(f), 0)
        const vetOut = list.filter(f => f.dir === 'out' && isVet(f.token)).reduce((s, f) => s + units(f), 0)
        const tokens = [...new Set(list.filter(f => !isVet(f.token)).map(f => f.token))]
        for (const token of tokens) {
            const e = entry(token)
            const inQty = list.filter(f => f.token === token && f.dir === 'in').reduce((s, f) => s + units(f), 0)
            const outQty = list.filter(f => f.token === token && f.dir === 'out').reduce((s, f) => s + units(f), 0)
            // a share of the VET when one transaction moves several tokens
            const share = tokens.length > 1 ? 1 / tokens.length : 1
            if (inQty > outQty && vetOut > 0) {
                e.qty += inQty - outQty
                e.cost += vetOut * share
                e.buys++
            } else if (outQty > inQty && vetIn > 0) {
                const sold = Math.min(outQty - inQty, e.qty)
                const avg = e.qty > 0 ? e.cost / e.qty : 0
                e.realized += vetIn * share * (sold / (outQty - inQty)) - avg * sold
                e.cost -= avg * sold
                e.qty -= sold
                e.sells++
            } else if (inQty > outQty) {
                e.unknown += inQty - outQty
            } else if (outQty > inQty) {
                // sent away: what is known goes at its average cost, the rest from the unknown
                const fromKnown = Math.min(outQty - inQty, e.qty)
                const avg = e.qty > 0 ? e.cost / e.qty : 0
                e.cost -= avg * fromKnown
                e.qty -= fromKnown
                e.unknown = Math.max(0, e.unknown - (outQty - inQty - fromKnown))
            }
        }
    }
    return [...book.values()].filter(e => e.buys || e.sells)
}
