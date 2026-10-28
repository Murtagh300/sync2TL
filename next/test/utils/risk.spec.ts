import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contractBornAt, riskLabels, type RiskInput } from 'src/utils/risk'
import { fns } from 'src/utils/actions'

const TOKEN = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
const C = '0x00000000000000000000000000000000000c0de1'
const base: RiskInput = {
    clauses: [{ to: C, value: '0', data: '0x12345678' }],
    changes: null,
    known: () => false,
    isToken: a => a === TOKEN,
    contracts: { [C]: 400 },
    used: new Set([C])
}

describe('riskLabels', () => {
    it('says nothing about an old contract used before', () => {
        expect(riskLabels(base)).toEqual([])
    })

    it('warns for a young contract and stops at a brand-new one', () => {
        expect(riskLabels({ ...base, contracts: { [C]: 12.6 } })).toEqual([{ level: 'warn', key: 'young_contract', params: { days: 12 } }])
        expect(riskLabels({ ...base, contracts: { [C]: 0.4 } })[0]).toEqual({ level: 'danger', key: 'new_contract', params: { days: 0 } })
    })

    it('mentions a first use once, after the warnings', () => {
        const D = '0x00000000000000000000000000000000000c0de2'
        const labels = riskLabels({ ...base, clauses: [...base.clauses, { to: D, value: '0', data: '0x' }], contracts: { [C]: 10, [D]: 400 }, used: new Set() })
        expect(labels.map(l => l.key)).toEqual(['young_contract', 'first_contract'])
    })

    it('leaves contracts the wallet knows alone', () => {
        expect(riskLabels({ ...base, contracts: { [C]: 0.1 }, used: new Set(), known: () => true })).toEqual([])
    })

    it('stops VET or tokens sent to a token contract', () => {
        const vet = riskLabels({ ...base, clauses: [{ to: TOKEN, value: '1000', data: '0x' }], contracts: {} })
        expect(vet).toEqual([{ level: 'danger', key: 'to_token_contract' }])
        const tok = riskLabels({ ...base, clauses: [{ to: TOKEN, value: '0', data: fns.transfer.encode(TOKEN, '5') }], contracts: {} })
        expect(tok).toEqual([{ level: 'danger', key: 'to_token_contract' }])
        // to a person: fine
        const ok = riskLabels({ ...base, clauses: [{ to: TOKEN, value: '0', data: fns.transfer.encode('0x000000000000000000000000000000000000beef', '5') }], contracts: {} })
        expect(ok).toEqual([])
    })

    it('warns when several things leave and nothing comes in', () => {
        const changes = { vet: -1n, tokens: { [TOKEN]: -5n }, nfts: [{ contract: C, tokenId: '1', amount: 1n, direction: 'out' as const }] }
        expect(riskLabels({ ...base, changes })).toEqual([{ level: 'warn', key: 'only_out', params: { n: 3 } }])
        expect(riskLabels({ ...base, changes: { ...changes, tokens: { [TOKEN]: 5n } } })).toEqual([])
    })
})

describe('contractBornAt', () => {
    beforeEach(() => {
        const m = new Map<string, string>()
        vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v) })
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('finds the first block with code', async () => {
        const born = 1234567
        const fetchMock = vi.fn(async (url: string) => {
            const n = Number(new URL(url).searchParams.get('revision'))
            return new Response(JSON.stringify({ hasCode: n >= born }))
        })
        vi.stubGlobal('fetch', fetchMock)
        expect(await contractBornAt('https://node.test', C, 20000000)).toBe(born)
        // kept: no second search
        const calls = fetchMock.mock.calls.length
        expect(calls).toBeLessThan(80)
        expect(await contractBornAt('https://node.test', C, 20000000)).toBe(born)
        expect(fetchMock.mock.calls.length).toBe(calls)
    })

    it('is null for an address without code', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ hasCode: false }))))
        expect(await contractBornAt('https://node.test', '0x00000000000000000000000000000000000c0de9', 100)).toBe(null)
    })
})
