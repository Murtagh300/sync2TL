// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { chainOf, gidOf, proposalGids } from 'src/utils/walletconnect'
import { costBasis } from 'src/utils/cost-basis'
import { splitShares } from 'src/utils/split-bill'
import { filterRows, emptyFilter } from 'src/utils/activity-filter'
import { contactsFromCsv, contactsToCsv } from 'src/utils/contacts-csv'
import { icsFor, upcomingPhases, toggleReminder, dueReminders } from 'src/utils/launch-calendar'
import { matchPaidRequests, payments } from 'src/utils/payments'
import { convertClauses, B3TR, VOT3 } from 'src/utils/ecosystem'
import { fns } from 'src/utils/actions'
import { genesises } from 'src/consts'
import type { Flow } from 'src/utils/overview'
import type { BVM } from 'boot/services/bvm'

const ZERO = '0x0000000000000000000000000000000000000000'
const TOKEN = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
const me = '0x00000000000000000000000000000000000000a1'
const E18 = 10n ** 18n

describe('WalletConnect networks', () => {
    it('maps VeChain chain ids to the genesis ids BlackVault knows', () => {
        const chain = chainOf(genesises.main.id)
        expect(chain).toBe(`vechain:${genesises.main.id.slice(-32)}`)
        expect(gidOf(chain)).toBe(genesises.main.id)
        expect(gidOf('eip155:1')).toBeNull()
        expect(gidOf('vechain:deadbeef')).toBeNull()
    })

    it('refuses proposals that require another chain', () => {
        const main = chainOf(genesises.main.id)
        expect(proposalGids({ requiredNamespaces: { vechain: { chains: [main] } } })).toEqual({ gids: [genesises.main.id], unsupported: false })
        expect(proposalGids({ requiredNamespaces: { vechain: { chains: [main] }, eip155: { chains: ['eip155:1'] } } }).unsupported).toBe(true)
        expect(proposalGids({ optionalNamespaces: { vechain: { chains: [main, 'vechain:x'] } } }).gids).toEqual([genesises.main.id])
    })
})

describe('cost basis', () => {
    const f = (txId: string, time: number, dir: 'in' | 'out', token: string, units: bigint): Flow =>
        ({ txId, time, dir, token, amount: units * E18, counterparty: '0xb', origin: me })

    it('averages buys and books the result of a sale', () => {
        const book = costBasis([
            // buy 100 for 10 VET, then 100 for 30 VET: average 0.2 VET
            f('a', 1, 'out', ZERO, 10n), f('a', 1, 'in', TOKEN, 100n),
            f('b', 2, 'out', ZERO, 30n), f('b', 2, 'in', TOKEN, 100n),
            // sell 50 for 15 VET: cost 10, profit 5
            f('c', 3, 'out', TOKEN, 50n), f('c', 3, 'in', ZERO, 15n),
            // a gift: no known cost
            f('d', 4, 'in', TOKEN, 7n)
        ])
        expect(book).toHaveLength(1)
        const e = book[0]!
        expect(e.qty).toBeCloseTo(150)
        expect(e.cost).toBeCloseTo(30)
        expect(e.realized).toBeCloseTo(5)
        expect(e.unknown).toBeCloseTo(7)
        expect([e.buys, e.sells]).toEqual([2, 1])
    })
})

describe('splitting a bill', () => {
    it('gives each person a share that is a little different', () => {
        expect(splitShares('100', 3)).toEqual(['33.3401', '33.3402', '33.3403'])
        expect(splitShares('10', 1)).toEqual([])
        expect(splitShares('x', 3)).toEqual([])
    })

    it('settles each request with its own payment', () => {
        const to = me
        payments.requests = [
            { id: 'r1', gid: 'g', to, amount: '5', symbol: 'VET', token: '', decimals: 18, note: '', createdAt: 1000 },
            { id: 'r2', gid: 'g', to, amount: '5', symbol: 'VET', token: '', decimals: 18, note: '', createdAt: 1001 }
        ]
        const one = { id: 'i1', txId: '0xt1', time: 5000, from: '0xb', to, kind: 'vet' as const, amount: (5n * E18).toString(), gid: 'g' }
        expect(matchPaidRequests([one])).toHaveLength(1)
        expect(payments.requests.filter(r => r.paid)).toHaveLength(1)
        expect(matchPaidRequests([one, { ...one, id: 'i2', txId: '0xt2' }])).toHaveLength(1)
        expect(payments.requests.every(r => r.paid)).toBe(true)
    })
})

describe('activity filters', () => {
    const rows = [
        { time: new Date(2026, 9, 20).getTime(), title: 'Received VET', tone: 'in' as const, amount: '+5 VET', counterparty: '0xabc', asset: { token: '' } },
        { time: new Date(2026, 0, 3).getTime(), title: 'Swap B3TR', tone: 'out' as const, note: 'rent', asset: { token: TOKEN } },
        { time: new Date(2025, 5, 1).getTime(), title: 'Failed', tone: 'fail' as const }
    ]
    const now = new Date(2026, 9, 25)

    it('narrows by words, direction, period and token', () => {
        expect(filterRows(rows, { ...emptyFilter(), q: 'rent' }, undefined, now)).toHaveLength(1)
        expect(filterRows(rows, { ...emptyFilter(), kind: 'in' }, undefined, now)).toHaveLength(1)
        expect(filterRows(rows, { ...emptyFilter(), period: 'year' }, undefined, now)).toHaveLength(2)
        expect(filterRows(rows, { ...emptyFilter(), period: 'month' }, undefined, now)).toHaveLength(1)
        expect(filterRows(rows, { ...emptyFilter(), token: TOKEN }, undefined, now)).toHaveLength(1)
        // a name finds its address
        expect(filterRows(rows, { ...emptyFilter(), q: 'kees' }, a => a === '0xabc' ? 'Kees' : '', now)).toHaveLength(1)
    })
})

describe('contacts as CSV', () => {
    it('round-trips names, addresses and groups, and guards formulas', () => {
        const csv = contactsToCsv([
            { name: '=cmd()', address: '0xC06f396e0B73c6b49862c5894B2C0b68F854E88e', groups: ['Team', 'Family'] }
        ])
        expect(csv.split('\n')[1]).toBe("'=cmd(),0xC06f396e0B73c6b49862c5894B2C0b68F854E88e,Team|Family")
        const back = contactsFromCsv(csv)
        expect(back.contacts).toEqual([{ name: '=cmd()', address: '0xC06f396e0B73c6b49862c5894B2C0b68F854E88e', groups: ['Team', 'Family'] }])
    })

    it('reads quoted cells and skips bad lines', () => {
        const { contacts, skipped } = contactsFromCsv('name;address\n"Doe, J";0xc06f396e0b73c6b49862c5894b2c0b68f854e88e\nnope;0x12')
        expect(contacts[0]!.name).toBe('Doe, J')
        expect(skipped).toBe(1)
    })
})

describe('launch calendar', () => {
    const launch = (phases: { index: number, label: string, start: string | null, end: string | null }[]) =>
        ({ slug: 'drop', name: 'Drop', phases }) as unknown as BVM.Launch
    const now = Date.parse('2026-10-25T12:00:00Z')

    it('lists phases that start later, soonest first', () => {
        const list = upcomingPhases([launch([
            { index: 0, label: 'Allowlist', start: '2026-10-27T18:00:00Z', end: null },
            { index: 1, label: 'Public', start: '2026-10-26T18:00:00Z', end: '2026-10-28T18:00:00Z' },
            { index: 2, label: 'Past', start: '2026-10-01T18:00:00Z', end: null }
        ])], now)
        expect(list.map(e => e.phase)).toEqual(['Public', 'Allowlist'])
        const ics = icsFor(list[0]!, 'https://blackvemarket.com/launchpad/drop', now)
        expect(ics).toContain('DTSTART:20261026T180000Z')
        expect(ics).toContain('TRIGGER:-PT15M')
    })

    it('fires a reminder once, a quarter before', () => {
        const e = { id: 'drop:1', slug: 'drop', name: 'Drop', phase: 'Public', start: now + 10 * 60 * 1000, end: null }
        localStorage.clear()
        expect(toggleReminder(e)).toBe(true)
        expect(dueReminders(now - 60 * 60 * 1000)).toHaveLength(0)
        expect(dueReminders(now)).toHaveLength(1)
        expect(dueReminders(now)).toHaveLength(0)
    })
})

describe('VeBetterDAO conversion', () => {
    it('approves exactly the amount before converting to VOT3', () => {
        const [approve, convert] = convertClauses('toVOT3', 5n * E18)
        expect(approve).toMatchObject({ to: B3TR, data: fns.approve.encode(VOT3, (5n * E18).toString()) })
        expect(convert!.to).toBe(VOT3)
        expect(convertClauses('toB3TR', 1n)).toHaveLength(1)
    })
})
