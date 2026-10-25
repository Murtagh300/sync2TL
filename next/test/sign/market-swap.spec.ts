import { describe, expect, it } from 'vitest'
import { address } from 'thor-devkit'
import { checkClauses } from 'src/utils/swap'
import { fns, decodeAction, ZERO_ADDRESS } from 'src/utils/actions'
import { listClauses, acceptOfferClauses, mintClauses } from 'src/utils/market'
import { buildPaymentLink, parsePaymentRequest } from 'src/utils/payment-request'

const router = '0xd747aa9ba03dd778f1452e45d0fbe3a682b644cd' // VeTrade
const token = '0x0000000000000000000000000000456e65726779'
const stranger = '0x00000000000000000000000000000000000000ee'

describe('swap routes from a quote service', () => {
    it('accept an approval of the input to a known router, then the swap', () => {
        expect(() => checkClauses([
            { to: token, value: '0', data: fns.approve.encode(router, 100) },
            { to: router, value: '0', data: '0x1841129c' }
        ], token, 100n)).not.toThrow()
        expect(() => checkClauses([{ to: router, value: '100', data: '0x1841129c' }], ZERO_ADDRESS, 100n)).not.toThrow()
    })

    it('refuse approvals to strangers, unknown contracts and extra VET', () => {
        expect(() => checkClauses([{ to: token, value: '0', data: fns.approve.encode(stranger, 100) }], token, 100n)).toThrow()
        expect(() => checkClauses([{ to: token, value: '0', data: fns.approve.encode(router, 101) }], token, 100n)).toThrow()
        expect(() => checkClauses([{ to: stranger, value: '0', data: '0x1841129c' }], token, 100n)).toThrow()
        expect(() => checkClauses([{ to: router, value: '500', data: '0x1841129c' }], ZERO_ADDRESS, 100n)).toThrow()
        expect(() => checkClauses([], token, 100n)).toThrow()
    })
})

describe('BlackVeMarket transactions', () => {
    const market = '0x1dcce1ad683c00d6df3dc1639bbdc88a8b8fed09'
    const nft = { contract: '0x9932690b32c4c0cd4d86a53eca948d33b1556ae7', tokenId: '4907', maasContract: market }

    it('list several NFTs with one approval per collection', () => {
        const clauses = listClauses([nft, { ...nft, tokenId: '1' }], '5000000000000000000', ZERO_ADDRESS)
        expect(clauses).toHaveLength(3)
        expect(decodeAction(clauses[0]!)).toMatchObject({ kind: 'approve-all', operator: market, approved: true })
        expect(decodeAction(clauses[1]!)).toMatchObject({ kind: 'list', tokenId: '4907', price: 5000000000000000000n })
    })

    it('accept an offer: approve the one NFT, then accept on the listing or blind', () => {
        const listed = acceptOfferClauses(nft, { isListed: true, saleId: '9', index: 2 })
        expect(decodeAction(listed[1]!)).toMatchObject({ kind: 'accept-offer', saleId: '9' })
        const blind = acceptOfferClauses(nft, { isListed: false, saleId: null, index: 0 })
        expect(decodeAction(blind[1]!)).toMatchObject({ kind: 'accept-offer', tokenId: '4907' })
    })

    it('mint pays in VET as value, or approves a token first', () => {
        expect(mintClauses(nft.contract, 0, 2, '5', null)).toEqual([expect.objectContaining({ value: '10' })])
        const withToken = mintClauses(nft.contract, 0, 2, '5', token)
        expect(decodeAction(withToken[0]!)).toMatchObject({ kind: 'approve', amount: 10n })
    })
})

describe('payment requests', () => {
    it('round-trip through a link', () => {
        const link = buildPaymentLink({ to: '0xc06f396e0b73c6b49862c5894b2c0b68f854e88e', amount: '1.5', symbol: 'VET' }, 'https://wallet.example/')
        expect(parsePaymentRequest(link)).toEqual({ to: address.toChecksumed('0xc06f396e0b73c6b49862c5894b2c0b68f854e88e'), amount: '1.5', symbol: 'VET' })
    })

    it('read a bare address, and nothing else', () => {
        expect(parsePaymentRequest('0xc06f396e0b73c6b49862c5894b2c0b68f854e88e')).toEqual({ to: '0xc06f396e0b73c6b49862c5894b2c0b68f854e88e' })
        expect(parsePaymentRequest('hello')).toBeNull()
        expect(parsePaymentRequest('https://x/#/send?to=nope')).toBeNull()
    })
})
