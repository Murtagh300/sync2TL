// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest'
import { advance, matchPaidRequests, payments, type ScheduledPayment } from 'src/utils/payments'
import { decodeContacts, encodeContacts } from 'src/utils/contacts-share'
import { listingSuggestions, parsePrice, traitHighlights } from 'src/utils/pricing'
import type { BVM } from 'boot/services/bvm'

const me = '0x00000000000000000000000000000000000000a1'

describe('payment requests', () => {
    beforeEach(() => {
        payments.requests = [{ id: 'r1', gid: 'g', to: me, amount: '25', symbol: 'VET', token: '', decimals: 18, note: 'pizza', createdAt: 1000 }]
    })

    it('are paid by an exact incoming amount after they were made', () => {
        const base = { gid: 'g', to: me, kind: 'vet' as const, from: '0xbb', txId: '0xt', id: 'x' }
        expect(matchPaidRequests([{ ...base, amount: '24000000000000000000', time: 5000 }])).toHaveLength(0)
        expect(matchPaidRequests([{ ...base, amount: '25000000000000000000', time: -100000 }])).toHaveLength(0)
        const paid = matchPaidRequests([{ ...base, amount: '25000000000000000000', time: 5000 }])
        expect(paid).toHaveLength(1)
        expect(payments.requests[0]!.paid).toMatchObject({ txId: '0xt', from: '0xbb' })
    })
})

describe('scheduled payments', () => {
    it('move on by a week or a month', () => {
        const s: ScheduledPayment = { id: 's', walletId: 1, addressIndex: 0, to: me, amount: '1', symbol: 'VET', note: '', every: 'month', next: new Date(2026, 0, 31).getTime() }
        advance(s, 0)
        expect(new Date(s.next).getMonth()).toBe(2) // Jan 31 + 1 month rolls into March, as Date does
        const w = { ...s, every: 'week' as const, next: new Date(2026, 5, 1).getTime() }
        advance(w, 0)
        expect(new Date(w.next).getDate()).toBe(8)
    })
})

describe('contacts as a QR code', () => {
    it('round-trip and drop bad addresses', () => {
        const text = encodeContacts([{ name: 'Kees', address: '0xc06f396e0b73c6b49862c5894b2c0b68f854e88e' }])
        expect(decodeContacts(text)).toEqual([{ name: 'Kees', address: '0xC06f396e0B73c6b49862c5894B2C0b68F854E88e' }])
        expect(decodeContacts('bvcontacts:1:[["x","nope"]]')).toEqual([])
        expect(decodeContacts('hello')).toBeNull()
    })
})

describe('price hints', () => {
    const nft = {
        traits: [
            { trait_type: 'Hat', value: 'Crown', percentage: 0.4, traitFloor: '300 VET' },
            // one silly asking price: not value
            { trait_type: 'Mouth', value: 'Gold', percentage: 3, traitFloor: '400000 VET' },
            { trait_type: 'Eyes', value: 'Blue', percentage: 20, traitFloor: '70 VET' }
        ],
        intelligence: { collection: { floor: '60 VET', floorValue: 60, floorCurrency: 'VET' } }
    } as unknown as BVM.NFT

    it('find the rarest and the most valued trait', () => {
        const h = traitHighlights(nft.traits, 60)
        expect(h.rarest?.value).toBe('Crown')
        expect(h.valuable?.value).toBe('Crown')
        expect(parsePrice('1,200.5 VET')).toEqual([1200.5, 'VET'])
    })

    it('suggest floor, trait floor and the median of recent sales', () => {
        const sale = (price: string) => ({ kind: 'sale', price }) as BVM.FeedItem
        const s = listingSuggestions(nft, [sale('50 VET'), sale('80 VET'), sale('65 VET'), sale('3 B3TR')])
        expect(s).toEqual([
            { key: 'floor', price: 60, currency: 'VET' },
            { key: 'trait', price: 300, currency: 'VET' },
            { key: 'sales', price: 65, currency: 'VET' }
        ])
    })
})
