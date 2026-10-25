import { KNOWN_MARKETS } from './known-markets'

/**
 * A period of the wallet's life, read from the chain (so also what happened before
 * BlackVault, or in another wallet with the same addresses): what came in and went out
 * per token, the fees paid and the NFT sales.
 */

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
export const ZERO = '0x0000000000000000000000000000000000000000'
const OFFERS = '0x181efd5a9ad8d9c3c56cc5ce66a98d3bec82dd4c'

export type Flow = {
    time: number
    txId: string
    dir: 'in' | 'out'
    /** the token contract; VET is the zero address */
    token: string
    amount: bigint
    counterparty: string
    /** who signed the transaction */
    origin: string
}

const pad = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0')
const topicAddress = (t: string) => '0x' + t.slice(-40).toLowerCase()

/** filters in pages of 256, up to a cap */
async function all<T>(page: (offset: number) => Promise<T[]>, cap = 4000): Promise<T[]> {
    const out: T[] = []
    for (let offset = 0; offset < cap; offset += 256) {
        const got = await page(offset)
        out.push(...got)
        if (got.length < 256) break
    }
    return out
}

/** VET and token transfers to and from the addresses between two times (ms) */
export async function flows(thor: Connex.Thor, addresses: string[], from: number, to: number): Promise<Flow[]> {
    const own = new Set(addresses.map(a => a.toLowerCase()))
    const range: Connex.Thor.Filter.Range = { unit: 'time', from: Math.floor(from / 1000), to: Math.floor(to / 1000) }
    const [vet, events] = await Promise.all([
        all(offset => thor.filter('transfer', addresses.flatMap(a => [{ sender: a }, { recipient: a }])).range(range).order('asc').apply(offset, 256)),
        all(offset => thor.filter('event', addresses.flatMap(a => [{ topic0: TRANSFER, topic1: pad(a) }, { topic0: TRANSFER, topic2: pad(a) }])).range(range).order('asc').apply(offset, 256))
    ])
    const out: Flow[] = []
    const push = (time: number, txId: string, origin: string, token: string, fromA: string, toA: string, amount: bigint) => {
        const mineFrom = own.has(fromA)
        const mineTo = own.has(toA)
        // between your own addresses: no flow
        if (mineFrom === mineTo || amount === 0n) return
        out.push({ time, txId, origin, token, amount, dir: mineTo ? 'in' : 'out', counterparty: mineTo ? fromA : toA })
    }
    for (const t of vet) {
        push(t.meta.blockTimestamp * 1000, t.meta.txID, t.meta.txOrigin.toLowerCase(), ZERO, t.sender.toLowerCase(), t.recipient.toLowerCase(), BigInt(t.amount))
    }
    for (const e of events) {
        // ERC-20 only: an NFT Transfer has the token id as a fourth topic
        if (e.topics.length !== 3) continue
        push(e.meta.blockTimestamp * 1000, e.meta.txID, e.meta.txOrigin.toLowerCase(), e.address.toLowerCase(),
            topicAddress(e.topics[1]!), topicAddress(e.topics[2]!), BigInt(e.data === '0x' ? 0 : e.data))
    }
    return out.sort((a, b) => a.time - b.time)
}

export type TokenTotals = { token: string, in: bigint, out: bigint }

/** what came in and went out, per token */
export function totals(list: Flow[]): TokenTotals[] {
    const map = new Map<string, TokenTotals>()
    for (const f of list) {
        const t = map.get(f.token) || { token: f.token, in: 0n, out: 0n }
        f.dir === 'in' ? t.in += f.amount : t.out += f.amount
        map.set(f.token, t)
    }
    return [...map.values()]
}

/** payments from a BlackVeMarket marketplace or the offers contract: NFT sales */
export function nftSales(list: Flow[]): Flow[] {
    return list.filter(f => f.dir === 'in' && (KNOWN_MARKETS.has(f.counterparty) || f.counterparty === OFFERS))
}

/** the VTHO the addresses paid in fees, from the receipts of the transactions they signed */
export async function feesPaid(thor: Connex.Thor, addresses: string[], txIds: string[], cap = 300): Promise<{ vtho: bigint, count: number, complete: boolean }> {
    const own = new Set(addresses.map(a => a.toLowerCase()))
    const ids = [...new Set(txIds.map(i => i.toLowerCase()))]
    let vtho = 0n
    let count = 0
    const todo = ids.slice(0, cap)
    for (let i = 0; i < todo.length; i += 8) {
        const receipts = await Promise.all(todo.slice(i, i + 8).map(id => thor.transaction(id).getReceipt().catch(() => null)))
        for (const r of receipts) {
            if (r && own.has(r.gasPayer.toLowerCase())) {
                vtho += BigInt(r.paid)
                count++
            }
        }
    }
    return { vtho, count, complete: ids.length <= cap }
}

/** the first and last moment of a month (month 0-11), local time */
export function monthRange(year: number, month: number): [number, number] {
    return [new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime() - 1]
}

export function yearRange(year: number): [number, number] {
    return [new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime() - 1]
}
