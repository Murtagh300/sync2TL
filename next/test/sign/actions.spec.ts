import { describe, expect, it } from 'vitest'
import { decodeAction, fns, UNLIMITED, contractName, rememberMarket } from 'src/utils/actions'
import { balanceChanges } from 'src/utils/simulate'

const me = '0x00000000000000000000000000000000000000a1'
const other = '0x00000000000000000000000000000000000000b2'
const token = '0x00000000000000000000000000000000000000c3'
const market = '0x1dcce1ad683c00d6df3dc1639bbdc88a8b8fed09'
const call = (to: string, data: string, value = '0') => ({ to, value, data })

describe('decodeAction', () => {
    it('reads approvals', () => {
        expect(decodeAction(call(token, fns.approve.encode(other, UNLIMITED.toString()))))
            .toEqual({ kind: 'approve', token, spender: other, amount: UNLIMITED })
        expect(decodeAction(call(token, fns.setApprovalForAll.encode(other, true))))
            .toEqual({ kind: 'approve-all', contract: token, operator: other, approved: true })
    })

    it('reads BlackVeMarket listings, purchases and offers', () => {
        const list = decodeAction(call(market, fns.createAuctionSale.encode(token, 7, '5', '5', 0, '0x0000000000000000000000000000000000000000')))
        expect(list).toMatchObject({ kind: 'list', market, contract: token, tokenId: '7', price: 5n })
        expect(decodeAction(call(market, fns.cancelSale.encode(12)))).toEqual({ kind: 'cancel-listing', market, saleId: '12' })
        expect(decodeAction(call(market, fns.fixedBuy.encode(12), '100'))).toEqual({ kind: 'buy', market, saleId: '12' })
        expect(decodeAction(call(market, fns.acceptBlindOffer.encode(token, 7, 0)))).toMatchObject({ kind: 'accept-offer', tokenId: '7' })
    })

    it('reads VVET wraps and launchpad mints', () => {
        const vvet = '0x45429a2255e7248e57fce99e7239aed3f84b7a53'
        expect(decodeAction(call(vvet, fns.deposit.encode(), '1000'))).toEqual({ kind: 'wrap', amount: 1000n })
        expect(decodeAction(call(token, fns.mint.encode(1, 3), '30'))).toEqual({ kind: 'mint', contract: token, phaseId: '1', quantity: 3 })
    })

    it('treats calls to known routers as swaps', () => {
        expect(decodeAction(call('0xd747aa9ba03dd778f1452e45d0fbe3a682b644cd', '0x1841129c' + '00'.repeat(32))))
            .toEqual({ kind: 'swap', router: '0xd747aa9ba03dd778f1452e45d0fbe3a682b644cd' })
    })

    it('leaves unknown calls alone', () => {
        expect(decodeAction(call(token, '0x12345678'))).toBeNull()
        expect(decodeAction(call(token, '0x'))).toBeNull()
    })

    it('names contracts it learned', () => {
        expect(contractName(market)).toBe('')
        rememberMarket(market)
        expect(contractName(market.toUpperCase().replace('0X', '0x'))).toBe('BlackVeMarket')
        expect(contractName('0x23cbbf0265f55574490ab6eb1ed8730c71e23d6c')).toBe('BetterSwap')
    })
})

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const topic = (a: string) => '0x' + a.slice(2).padStart(64, '0')
const num = (n: bigint) => n.toString(16).padStart(64, '0')
const output = (o: Partial<Connex.VM.Output>): Connex.VM.Output => ({
    contractAddress: null, gasUsed: 0, reverted: false, vmError: '', revertReason: '', events: [], transfers: [], ...o
} as unknown as Connex.VM.Output)

describe('balanceChanges', () => {
    it('sums VET, tokens and NFTs for the account', () => {
        const changes = balanceChanges([
            output({ transfers: [{ sender: me, recipient: other, amount: '0x64' }] as Connex.VM.Transfer[] }),
            output({
                events: [
                    { address: token, topics: [TRANSFER, topic(other), topic(me)], data: '0x' + num(500n) },
                    { address: market, topics: [TRANSFER, topic(me), topic(other), topic('0x' + num(4907n))], data: '0x' }
                ] as Connex.VM.Event[]
            })
        ], me)
        expect(changes.vet).toBe(-100n)
        expect(changes.tokens[token]).toBe(500n)
        expect(changes.nfts).toEqual([{ contract: market, tokenId: '4907', amount: 1n, direction: 'out' }])
    })

    it('nets out an NFT that comes and goes', () => {
        const ev = (from: string, to: string) => ({ address: market, topics: [TRANSFER, topic(from), topic(to), topic('0x' + num(1n))], data: '0x' })
        const changes = balanceChanges([output({ events: [ev(other, me), ev(me, other)] as Connex.VM.Event[] })], me)
        expect(changes.nfts).toEqual([])
    })
})
