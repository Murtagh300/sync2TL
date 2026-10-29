import { describe, expect, it } from 'vitest'
import { Keystore, secp256k1 } from 'thor-devkit'
import { claimClauses, giftAddress, giftClauses, giftKeyFrom, giftLink, GIFT_VTHO, newGiftKey } from 'src/utils/gift'
import { invoiceHtml, invoiceTotals, nextInvoiceNumber, type Invoice } from 'src/utils/invoice'
import { tillCsv, tillDays } from 'src/utils/pos'
import { keystoreFileName, parseKeystore } from 'src/utils/keystore'
import { tapLink } from 'src/utils/till-tap'
import { fns } from 'src/utils/actions'

const E18 = 10n ** 18n
const VTHO = '0x0000000000000000000000000000456e65726779'
const B3TR = '0x5ef79995fe8a89e0812330e4378eb2660cede699'

describe('money links', () => {
    it('a link carries a key the wallet reads back, and nothing else passes for one', () => {
        const { key, address } = newGiftKey()
        const link = giftLink(key, 'Fijne verjaardag', 'https://wallet.example/')
        expect(link).toBe(`https://wallet.example/#/claim?k=${key}&n=Fijne%20verjaardag`)
        const sk = giftKeyFrom(link)!
        expect(sk.toString('hex')).toBe(key)
        expect(giftAddress(sk)).toBe(address)
        expect(giftKeyFrom('0'.repeat(64))).toBeNull()
        expect(giftKeyFrom('f'.repeat(64))).toBeNull()
        expect(giftKeyFrom('hello')).toBeNull()
    })

    it('sends the amount and the VTHO for picking it up', () => {
        const to = '0x' + 'a'.repeat(40)
        const vet = giftClauses(to, 5n * E18, '', VTHO)
        expect(vet).toHaveLength(2)
        expect(vet[0]).toEqual({ to, value: (5n * E18).toString(), data: '0x' })
        expect(vet[1]!.data).toBe(fns.transfer.encode(to, GIFT_VTHO.toString()))
        const b3tr = giftClauses(to, 3n * E18, B3TR, VTHO)
        expect(b3tr.map(c => c.to)).toEqual([B3TR, VTHO])
        // VTHO itself: one transfer, with the fee money added
        const vtho = giftClauses(to, 3n * E18, VTHO, VTHO)
        expect(vtho).toHaveLength(1)
        expect(vtho[0]!.data).toBe(fns.transfer.encode(to, (3n * E18 + GIFT_VTHO).toString()))
    })

    it('picks everything up and leaves just the fee in VTHO', () => {
        const specs = [{ symbol: 'VET', address: '0x' + '0'.repeat(40), decimals: 18 }, { symbol: 'VTHO', address: VTHO, decimals: 18 }]
        const { clauses, parts } = claimClauses(specs, [5n * E18, 2n * E18], '0x' + 'b'.repeat(40), 3n * 10n ** 17n)
        expect(parts).toEqual(['5 VET', '1 VTHO'])
        expect(clauses).toHaveLength(2)
    })
})

describe('invoices', () => {
    it('adds lines and VAT in cents', () => {
        expect(invoiceTotals([{ text: 'a', qty: 3, price: 19.99 }, { text: 'b', qty: 1, price: 0.05 }], 21)).toEqual({ net: 60.02, vat: 12.6, total: 72.62 })
    })

    it('numbers per year', () => {
        const now = new Date('2026-10-29T12:00:00')
        expect(nextInvoiceNumber([], now)).toBe('2026-001')
        expect(nextInvoiceNumber([{ number: '2026-007' }, { number: '2025-020' }], now)).toBe('2026-008')
    })

    it('puts text in as text', () => {
        const inv: Invoice = {
            id: 'x', number: '2026-001', createdAt: Date.UTC(2026, 9, 29), dueDays: 14,
            seller: { name: 'Shop <b>', details: 'Street 1\nTown', vat: 'NL1' }, buyer: { name: 'Klant', details: '' },
            lines: [{ text: '<script>x</script>', qty: 1, price: 10 }], vatRate: 21, currency: 'EUR',
            symbol: 'VET', amount: '500.0012', rate: 0.0242, to: '0x' + 'a'.repeat(40), note: '', requestId: 'r'
        }
        const labels = Object.fromEntries(['title', 'number', 'date', 'due', 'from', 'to', 'vatNumber', 'item', 'qty', 'price', 'total', 'net', 'vat', 'pay', 'rate', 'paid'].map(k => [k, k])) as Parameters<typeof invoiceHtml>[1]
        const html = invoiceHtml(inv, labels, 'https://wallet.example/#/send?to=x', { lang: 'en', paid: false })
        expect(html).not.toContain('<script>x')
        expect(html).toContain('&lt;script&gt;')
        expect(html).toContain('Shop &lt;b&gt;')
        expect(html).toContain('Street 1<br>Town')
        expect(html).toContain('<svg')
        expect(html).toContain('500.0012 VET')
    })
})

describe('the till', () => {
    const at = (d: string) => new Date(d).getTime()
    const sales = [
        { amount: '100.0012', symbol: 'VET', fiat: 2.5, currency: 'EUR', paid: { at: at('2026-10-29T10:00:00'), txId: '0x1', from: '0xf' } },
        { amount: '50.0005', symbol: 'VET', fiat: 1.25, currency: 'EUR', paid: { at: at('2026-10-29T16:00:00'), txId: '0x2', from: '0xf' } },
        { amount: '3', symbol: 'B3TR', fiat: 0.3, currency: 'EUR', paid: { at: at('2026-10-28T09:00:00'), txId: '0x3', from: '0xf' } },
        // not paid, or not from the till: left out
        { amount: '9', symbol: 'VET', fiat: 1, currency: 'EUR' },
        { amount: '9', symbol: 'VET', paid: { at: at('2026-10-29T11:00:00'), txId: '0x4', from: '0xf' } }
    ]

    it('adds the paid sales up per day', () => {
        const days = tillDays(sales)
        expect(days.map(d => d.day)).toEqual(['2026-10-29', '2026-10-28'])
        expect(days[0]).toEqual({ day: '2026-10-29', count: 2, fiat: { EUR: 3.75 }, tokens: { VET: '150.0017' } })
    })

    it('writes one CSV line per sale', () => {
        const csv = tillCsv(sales, ['date', 'value', 'currency', 'amount', 'token', 'from', 'tx']).split('\n')
        expect(csv).toHaveLength(4)
        // oldest first
        expect(csv[1]).toContain(',0.3,EUR,3,B3TR,0xf,0x3')
        expect(csv[2]).toContain(',2.5,EUR,100.0012,VET,0xf,0x1')
    })

    it('links a sticker to the till', () => {
        expect(tapLink('abc123def456', 'https://wallet.example/')).toBe('https://wallet.example/#/tap/abc123def456')
    })
})

describe('keystore files', () => {
    it('reads a keystore, with or without a byte order mark', async () => {
        const ks = await Keystore.encrypt(secp256k1.generatePrivateKey(), 'password1')
        expect(parseKeystore(JSON.stringify(ks))).not.toBeNull()
        expect(parseKeystore('﻿' + JSON.stringify(ks))).not.toBeNull()
        expect(parseKeystore('{"a":1}')).toBeNull()
        expect(parseKeystore('nope')).toBeNull()
    }, 30000)

    it('names the file the usual way', () => {
        expect(keystoreFileName('0xABCdef0000000000000000000000000000000001', new Date('2026-10-29T10:11:12.000Z'))).toBe('UTC--2026-10-29T10-11-12.000Z--abcdef0000000000000000000000000000000001.json')
    })
})
