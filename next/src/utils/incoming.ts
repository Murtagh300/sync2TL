/**
 * What arrived on the wallet's addresses without it signing anything: VET, tokens and
 * NFTs others sent. Read from the chain's logs, newest first.
 */

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export type Incoming = {
    id: string
    txId: string
    time: number
    from: string
    to: string
    kind: 'vet' | 'token' | 'nft'
    /** the token or NFT contract */
    contract?: string
    /** wei for VET and tokens */
    amount?: string
    tokenId?: string
}

const pad = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0')
const addr = (topic: string) => '0x' + topic.slice(-40).toLowerCase()

export async function incomingTransfers(thor: Connex.Thor, addresses: string[], limit = 30): Promise<Incoming[]> {
    if (!addresses.length) {
        return []
    }
    const [vet, events] = await Promise.all([
        thor.filter('transfer', addresses.map(a => ({ recipient: a }))).order('desc').apply(0, limit),
        thor.filter('event', addresses.map(a => ({ topic0: TRANSFER, topic2: pad(a) }))).order('desc').apply(0, limit)
    ])
    const own = new Set(addresses.map(a => a.toLowerCase()))
    const out: Incoming[] = []
    for (const t of vet) {
        // moving between your own addresses isn't news
        if (own.has(t.sender.toLowerCase())) continue
        out.push({
            id: `vet:${t.meta.txID}:${t.meta.clauseIndex}:${t.recipient}`,
            txId: t.meta.txID,
            time: t.meta.blockTimestamp * 1000,
            from: t.sender.toLowerCase(),
            to: t.recipient.toLowerCase(),
            kind: 'vet',
            amount: BigInt(t.amount).toString()
        })
    }
    for (const e of events) {
        const from = addr(e.topics[1]!)
        if (own.has(from)) continue
        const isNft = e.topics.length === 4
        out.push({
            id: `ev:${e.meta.txID}:${e.meta.clauseIndex}:${e.address}:${e.topics[3] || e.data}`,
            txId: e.meta.txID,
            time: e.meta.blockTimestamp * 1000,
            from,
            to: addr(e.topics[2]!),
            kind: isNft ? 'nft' : 'token',
            contract: e.address.toLowerCase(),
            ...(isNft ? { tokenId: BigInt(e.topics[3]!).toString() } : { amount: BigInt(e.data === '0x' ? 0 : e.data).toString() })
        })
    }
    return out.sort((a, b) => b.time - a.time).slice(0, limit)
}
