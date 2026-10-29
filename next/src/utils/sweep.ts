import { fns } from './actions'
import { formatUnits } from './format'

/**
 * Everything on an address, as clauses that send it to one place: tokens, then VET, and VTHO
 * minus a reserve so the transaction can pay its own fee. Used to merge addresses
 * (Consolidate) and to get a wallet to safety (Panic).
 */

export type Clause = { to: string, value: string, data: string }

/** VTHO left behind on each address: its own transaction pays its fee */
export const RESERVE_VTHO = 10

export function sweepClauses(
    specs: { symbol: string, address: string, decimals: number }[],
    balances: bigint[],
    to: string,
    reserveVtho = RESERVE_VTHO
): { clauses: Clause[], parts: string[] } {
    const clauses: Clause[] = []
    const parts: string[] = []
    let vet = 0n
    let vtho = 0n
    specs.forEach((spec, k) => {
        const b = balances[k] || 0n
        if (b <= 0n) return
        if (spec.symbol === 'VET') vet = b
        else if (spec.symbol === 'VTHO') vtho = b
        else {
            clauses.push({ to: spec.address, value: '0', data: fns.transfer.encode(to, b.toString()) })
            parts.push(`${formatUnits(b, spec.decimals, 2)} ${spec.symbol}`)
        }
    })
    if (vet > 0n) {
        clauses.push({ to, value: vet.toString(), data: '0x' })
        parts.unshift(`${formatUnits(vet, 18, 2)} VET`)
    }
    const reserve = BigInt(reserveVtho) * 10n ** 18n
    const vthoSpec = specs.find(s => s.symbol === 'VTHO')
    if (vthoSpec && vtho > reserve) {
        clauses.push({ to: vthoSpec.address, value: '0', data: fns.transfer.encode(to, (vtho - reserve).toString()) })
        parts.push(`${formatUnits(vtho - reserve, 18, 2)} VTHO`)
    }
    return { clauses, parts }
}
