import { describe, expect, it } from 'vitest'
import { address, blake2b256, Certificate, secp256k1 } from 'thor-devkit'
import { monthRange, netByToken, statementHtml, statementLines, VTHO } from 'src/utils/statement'
import { registryLabels } from 'src/utils/known-labels'
import { checkCertificate } from 'src/utils/cert-check'
import type { Flow } from 'src/utils/overview'

const E18 = 10n ** 18n
const ME = '0x' + 'a'.repeat(40)
const ME2 = '0x' + 'b'.repeat(40)
const THEM = '0x' + 'c'.repeat(40)
const ZERO = '0x0000000000000000000000000000000000000000'
const flow = (dir: 'in' | 'out', token: string, amount: bigint, counterparty = THEM): Flow => ({ time: 1, txId: '0x1', dir, token, amount, counterparty, origin: ME })

describe('the monthly statement', () => {
    it('spans the whole month', () => {
        const [from, to] = monthRange(2026, 1)
        expect(new Date(from).getDate()).toBe(1)
        expect(new Date(from).getMonth()).toBe(1)
        expect(new Date(to + 1).getMonth()).toBe(2)
    })

    it('works the balances back from today, leaving out own moves', () => {
        const inMonth = netByToken([flow('in', ZERO, 100n * E18), flow('out', ZERO, 30n * E18), flow('out', ZERO, 5n * E18, ME2)], [ME, ME2])
        const after = netByToken([flow('in', ZERO, 10n * E18)], [ME, ME2])
        const now = new Map([[ZERO, 200n * E18], [VTHO, 50n * E18]])
        const lines = statementLines([ZERO, VTHO], now, inMonth, after, 2n * E18, 0n)
        const vet = lines.find(l => l.token === ZERO)!
        expect(vet).toEqual({ token: ZERO, start: 120n * E18, in: 100n * E18, out: 30n * E18, fees: 0n, end: 190n * E18 })
        const vtho = lines.find(l => l.token === VTHO)!
        expect(vtho.fees).toBe(2n * E18)
        expect(vtho.start - vtho.end).toBe(2n * E18)
    })

    it('puts every value in as text', () => {
        const html = statementHtml({ title: '<b>', period: 'p', addresses: 'a', token: 't', start: 's', in: 'i', out: 'o', fees: 'f', end: 'e', transactions: 'x', date: 'd', amount: 'm', with: 'w', none: 'n', footer: 'z' },
            [{ symbol: '<script>', start: '1', in: '2', out: '3', fees: '', end: '4' }], [{ date: 'd', amount: '+1 VET', with: '"x"' }], [ME], 'en')
        expect(html).not.toContain('<script>')
        expect(html).toContain('&lt;script&gt;')
        expect(html).toContain('&quot;x&quot;')
    })
})

describe('known labels', () => {
    it('names tokens by symbol and collections by name, safely', () => {
        const labels = registryLabels(
            [{ address: '0x5EF79995FE8A89E0812330E4378EB2660CEDE699', symbol: 'B3TR' }, { address: 'nope', symbol: 'X' }],
            [{ address: THEM, name: 'Ape <img src=x>\u0007 Club' }]
        )
        expect(labels['0x5ef79995fe8a89e0812330e4378eb2660cede699']).toBe('B3TR')
        expect(labels[THEM]).toBe('Ape img src=x Club')
        expect(Object.keys(labels)).toHaveLength(2)
    })
})

describe('signed messages', () => {
    it('checks a certificate and refuses a changed one', () => {
        const sk = secp256k1.generatePrivateKey()
        const signer = address.fromPublicKey(secp256k1.derivePublicKey(sk))
        const cert: Certificate = { purpose: 'identification', payload: { type: 'text', content: 'This address is mine' }, domain: 'wallet.example', timestamp: 1790000000, signer }
        const signed = { ...cert, signature: '0x' + secp256k1.sign(blake2b256(Certificate.encode(cert)), sk).toString('hex') }
        const ok = checkCertificate(JSON.stringify(signed))
        expect(ok).toEqual({ ok: true, signer: signer.toLowerCase(), text: 'This address is mine', time: 1790000000000, domain: 'wallet.example' })
        expect(checkCertificate(JSON.stringify({ ...signed, payload: { type: 'text', content: 'Something else' } })).ok).toBe(false)
        expect(checkCertificate('{').ok).toBe(false)
    })
})
