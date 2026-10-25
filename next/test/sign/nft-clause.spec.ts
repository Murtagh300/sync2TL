import { describe, expect, it } from 'vitest'
import { abi } from 'thor-devkit'
import { decodeAsNftTransferClause } from 'src/pages/Sign/helper'

const from = '0x0000000000000000000000000000000000000001'
const to = '0x00000000000000000000000000000000000000a2'
const fn = (name: string, inputs: [string, string][]) => new abi.Function({
    constant: false,
    inputs: inputs.map(([n, type]) => ({ name: n, type })),
    name,
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
})
const clause = (data: string) => ({ to: '0x00000000000000000000000000000000000000c0', value: '0', data })

describe('decodeAsNftTransferClause', () => {
    it('reads ERC-721 transferFrom', () => {
        const data = fn('transferFrom', [['from', 'address'], ['to', 'address'], ['tokenId', 'uint256']]).encode(from, to, 4907)
        expect(decodeAsNftTransferClause(clause(data))).toEqual({ to, tokenId: '4907' })
    })

    it('reads both ERC-721 safeTransferFrom forms', () => {
        const a = fn('safeTransferFrom', [['from', 'address'], ['to', 'address'], ['tokenId', 'uint256']]).encode(from, to, 7)
        const b = fn('safeTransferFrom', [['from', 'address'], ['to', 'address'], ['tokenId', 'uint256'], ['data', 'bytes']]).encode(from, to, 8, '0x')
        expect(decodeAsNftTransferClause(clause(a))).toEqual({ to, tokenId: '7' })
        expect(decodeAsNftTransferClause(clause(b))).toEqual({ to, tokenId: '8' })
    })

    it('reads ERC-1155 safeTransferFrom with its amount', () => {
        const data = fn('safeTransferFrom', [['from', 'address'], ['to', 'address'], ['id', 'uint256'], ['amount', 'uint256'], ['data', 'bytes']]).encode(from, to, 12, 3, '0x')
        expect(decodeAsNftTransferClause(clause(data))).toEqual({ to, tokenId: '12', amount: '3' })
    })

    it('ignores other calls', () => {
        const transfer = fn('transfer', [['to', 'address'], ['amount', 'uint256']]).encode(to, 5)
        expect(decodeAsNftTransferClause(clause(transfer))).toBeNull()
        expect(decodeAsNftTransferClause(clause('0x'))).toBeNull()
        expect(decodeAsNftTransferClause(clause('0x23b872dd00'))).toBeNull()
    })
})
