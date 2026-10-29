import { describe, expect, it } from 'vitest'
import { abi } from 'thor-devkit'
import { revertReason, splitWeights, voteClause } from 'src/utils/vote'
import { bestQuote, type Quote } from 'src/utils/swap'
import { cleanLabel, namehash } from 'src/utils/vet-names'

const E18 = 10n ** 18n

describe('splitWeights', () => {
    it('shares the whole power, rounding into the first', () => {
        const parts = splitWeights(100n * E18, [50, 50, 50])
        expect(parts.reduce((a, b) => a + b, 0n)).toBe(100n * E18)
        expect(parts[1]).toBe(parts[2])
        expect(splitWeights(10n, [3, 1])).toEqual([8n, 2n])
        expect(splitWeights(0n, [1])).toEqual([0n])
    })

    it('leaves out apps without weight in the vote', () => {
        const c = voteClause(122, [{ id: '0x' + '1'.repeat(64), weight: 5n }, { id: '0x' + '2'.repeat(64), weight: 0n }])
        const d = abi.decodeParameters([{ type: 'uint256', name: 'r' }, { type: 'bytes32[]', name: 'ids' }, { type: 'uint256[]', name: 'w' }], '0x' + c.data.slice(10))
        expect(d.ids).toEqual(['0x' + '1'.repeat(64)])
        expect(d.w).toEqual(['5'])
    })

    it('reads a revert reason', () => {
        const data = '0x08c379a0' + abi.encodeParameter('string', 'User does not meet the criteria to be considered a person').slice(2)
        expect(revertReason(data)).toMatch(/person/)
        expect(revertReason('0x')).toBe('')
    })
})

describe('bestQuote', () => {
    const q = (amountOut: bigint, source: Quote['source']): Quote => ({ amountOut, amountOutMin: amountOut, clauses: [], source })
    it('takes the one that pays more, VeTrade on a tie', () => {
        expect(bestQuote(q(10n, 'VeTrade'), q(11n, 'BetterSwap')).source).toBe('BetterSwap')
        expect(bestQuote(q(10n, 'VeTrade'), q(10n, 'BetterSwap')).source).toBe('VeTrade')
        expect(bestQuote(null, q(1n, 'BetterSwap')).source).toBe('BetterSwap')
        expect(() => bestQuote(null, null)).toThrow()
    })
})

describe('vet names', () => {
    it('cleans a label and hashes names the ENS way', () => {
        expect(cleanLabel(' Hello.VET ')).toBe('hello')
        expect(cleanLabel('a.b')).toBe('')
        expect(namehash('eth')).toBe('0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae')
    })
})
