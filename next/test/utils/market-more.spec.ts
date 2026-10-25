import { describe, expect, it } from 'vitest'
import { buyClauses, collectionOfferClauses, offerClauses, OFFERS_CONTRACT, VVET } from 'src/utils/market'
import { decodeAction, fns, ZERO_ADDRESS } from 'src/utils/actions'
import { toCsv } from 'src/utils/export'

const market = '0xc78bcf5486facc1449ff5e4477111089e98373fa'
const nft = { contract: '0xee90a004812aee6173741b14b07ca3c83bc21736', tokenId: '44', maasContract: market }

describe('buying on BlackVeMarket', () => {
    it('pays VET as value, a token after approving it', () => {
        expect(buyClauses({ ...nft, saleId: '6', rawPrice: '60', paymentToken: ZERO_ADDRESS }))
            .toEqual([{ to: market, value: '60', data: fns.fixedBuy.encode('6') }])
        const token = '0xb27a1fb87935b85cdaa2e16468247278c74c5ec7'
        const withToken = buyClauses({ ...nft, saleId: '6', rawPrice: '60', paymentToken: token })
        expect(decodeAction(withToken[0]!)).toMatchObject({ kind: 'approve', spender: market, amount: 60n })
        expect(decodeAction(withToken[1]!)).toMatchObject({ kind: 'buy', saleId: '6' })
    })
})

describe('offers', () => {
    it('wrap VET into VVET first, then approve and offer', () => {
        const c = offerClauses(nft, '100', 'VET')
        expect(decodeAction(c[0]!)).toEqual({ kind: 'wrap', amount: 100n })
        expect(decodeAction(c[1]!)).toMatchObject({ kind: 'approve', token: VVET.toLowerCase(), spender: market, amount: 100n })
        expect(decodeAction(c[2]!)).toMatchObject({ kind: 'offer', tokenId: '44', amount: 100n })
    })

    it('on a listing offer on its sale', () => {
        const c = offerClauses({ ...nft, listed: true, saleId: '9' }, '5', 'B3TR')
        expect(c).toHaveLength(2)
        expect(decodeAction(c[1]!)).toMatchObject({ kind: 'offer', saleId: '9' })
    })

    it('on a collection fund the total for the offers contract', () => {
        const c = collectionOfferClauses(nft.contract, '10', 3, 'VET', 7)
        expect(decodeAction(c[0]!)).toEqual({ kind: 'wrap', amount: 30n })
        expect(decodeAction(c[1]!)).toMatchObject({ kind: 'approve', spender: OFFERS_CONTRACT.toLowerCase(), amount: 30n })
        expect(decodeAction(c[2]!)).toMatchObject({ kind: 'collection-offer', contract: nft.contract, price: 10n, quantity: 3 })
    })
})

describe('CSV export', () => {
    it('quotes what needs quoting', () => {
        const csv = toCsv([{ time: 0, type: 'Sent', title: 'Rent, October', amount: '−5 VET', counterparty: '0xab', txId: '0x1', note: 'say "hi"', value: '1.00' }],
            ['Date', 'Type', 'What', 'Amount', 'Counterparty', 'Tx', 'Note', 'Value'])
        const [, row] = csv.split('\n')
        expect(row).toBe('1970-01-01T00:00:00.000Z,Sent,"Rent, October",−5 VET,0xab,0x1,"say ""hi""",1.00')
    })
})
