/**
 * What a transaction does to the signer's balances, read from a dry run (thor.explain):
 * VET from the transfers, tokens and NFTs from the Transfer events.
 */

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const TRANSFER_SINGLE = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62'
const TRANSFER_BATCH = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'
// wrapped VET (WETH9 style) mints and burns without a Transfer event
const DEPOSIT = '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c'
const WITHDRAWAL = '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65'

export type NftChange = { contract: string, tokenId: string, amount: bigint, direction: 'in' | 'out' }

export type BalanceChanges = {
    /** VET, in wei; negative is spent */
    vet: bigint
    /** tokens by contract address (lower case), in the token's smallest unit */
    tokens: Record<string, bigint>
    nfts: NftChange[]
}

const word = (data: string, i: number) => BigInt('0x' + (data.slice(2 + i * 64, 2 + (i + 1) * 64) || '0'))
const topicAddress = (topic: string) => '0x' + topic.slice(-40).toLowerCase()

export function balanceChanges(outputs: Connex.VM.Output[], account: string): BalanceChanges {
    const me = account.toLowerCase()
    const ret: BalanceChanges = { vet: 0n, tokens: {}, nfts: [] }
    const addToken = (token: string, delta: bigint) => {
        ret.tokens[token] = (ret.tokens[token] || 0n) + delta
    }
    const addNft = (contract: string, tokenId: string, amount: bigint, direction: 'in' | 'out') => {
        // an NFT that comes and goes in the same transaction nets out
        const opposite = ret.nfts.findIndex(n => n.contract === contract && n.tokenId === tokenId && n.direction !== direction)
        if (opposite >= 0) {
            ret.nfts.splice(opposite, 1)
            return
        }
        ret.nfts.push({ contract, tokenId, amount, direction })
    }

    for (const out of outputs) {
        for (const t of out.transfers) {
            const amount = BigInt(t.amount)
            if (t.sender.toLowerCase() === me) {
                ret.vet -= amount
            }
            if (t.recipient.toLowerCase() === me) {
                ret.vet += amount
            }
        }
        for (const ev of out.events) {
            const contract = ev.address.toLowerCase()
            // the branches below check how many topics there are
            const [topic0, t1 = '', t2 = '', t3 = ''] = ev.topics
            try {
                if (topic0 === TRANSFER && ev.topics.length === 3) {
                    // ERC-20: the amount is in the data
                    const amount = word(ev.data, 0)
                    if (topicAddress(t1) === me) addToken(contract, -amount)
                    if (topicAddress(t2) === me) addToken(contract, amount)
                } else if (topic0 === TRANSFER && ev.topics.length === 4) {
                    // ERC-721: the token id is the third indexed topic
                    const tokenId = BigInt(t3).toString()
                    if (topicAddress(t1) === me) addNft(contract, tokenId, 1n, 'out')
                    if (topicAddress(t2) === me) addNft(contract, tokenId, 1n, 'in')
                } else if ((topic0 === DEPOSIT || topic0 === WITHDRAWAL) && ev.topics.length === 2) {
                    if (topicAddress(t1) === me) addToken(contract, topic0 === DEPOSIT ? word(ev.data, 0) : -word(ev.data, 0))
                } else if (topic0 === TRANSFER_SINGLE) {
                    // ERC-1155: (operator, from, to) indexed, (id, value) in the data
                    const tokenId = word(ev.data, 0).toString()
                    const amount = word(ev.data, 1)
                    if (topicAddress(t2) === me) addNft(contract, tokenId, amount, 'out')
                    if (topicAddress(t3) === me) addNft(contract, tokenId, amount, 'in')
                } else if (topic0 === TRANSFER_BATCH) {
                    // (uint256[] ids, uint256[] values): offsets, then the arrays
                    const idsAt = Number(word(ev.data, 0)) / 32
                    const valuesAt = Number(word(ev.data, 1)) / 32
                    const n = Number(word(ev.data, idsAt))
                    for (let i = 0; i < n; i++) {
                        const tokenId = word(ev.data, idsAt + 1 + i).toString()
                        const amount = word(ev.data, valuesAt + 1 + i)
                        if (topicAddress(t2) === me) addNft(contract, tokenId, amount, 'out')
                        if (topicAddress(t3) === me) addNft(contract, tokenId, amount, 'in')
                    }
                }
            } catch {
                // a malformed log is skipped, not fatal
            }
        }
    }
    for (const [k, v] of Object.entries(ret.tokens)) {
        if (v === 0n) delete ret.tokens[k]
    }
    return ret
}
