// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest'
import { isHidden, nftKey } from 'src/utils/hidden-nfts'
import { setTxNote, txNote } from 'src/utils/tx-notes'
import { dappsFromActivity } from 'src/utils/dapps'
import { readSnapshot, writeSnapshot } from 'src/utils/snapshot'

const nft = (contract: string, tokenId: string, collectionSlug: string) => ({ contract, tokenId, collectionSlug })

describe('hidden NFTs', () => {
    const verified = new Set(['squadonians'])

    it('hides unverified collections unless shown, and what the user hid', () => {
        const h = { hidden: [nftKey('0xAA', '1')], shown: [nftKey('0xbb', '2')] }
        expect(isHidden(h, verified, nft('0xaa', '1', 'squadonians'))).toBe(true)
        expect(isHidden(h, verified, nft('0xbb', '3', 'factory'))).toBe(true)
        expect(isHidden(h, verified, nft('0xbb', '2', 'factory'))).toBe(false)
        expect(isHidden(h, verified, nft('0xcc', '9', 'squadonians'))).toBe(false)
    })

    it('hides nothing for being unverified before the list of collections is known', () => {
        expect(isHidden({ hidden: [], shown: [] }, null, nft('0xbb', '3', 'factory'))).toBe(false)
    })
})

describe('transaction notes', () => {
    beforeEach(() => localStorage.clear())

    it('are kept per transaction, case-insensitively, and cleared when empty', () => {
        setTxNote('0xABC', '  rent  ')
        expect(txNote('0xabc')).toBe('rent')
        setTxNote('0xabc', '')
        expect(txNote('0xABC')).toBe('')
    })
})

describe('connected sites', () => {
    it('groups activity by site, newest first', () => {
        const a = (id: number, origin: string, type: 'tx' | 'cert', createdTime: number) =>
            ({ id, gid: '', walletId: 1, type, status: '', createdTime, glob: { origin } }) as unknown as M.Activity
        const list = dappsFromActivity([
            a(1, 'https://blackvemarket.com/x', 'tx', 10),
            a(2, 'https://vetrade.vet', 'cert', 30),
            a(3, 'https://blackvemarket.com/y', 'cert', 20),
            a(4, '', 'tx', 40)
        ])
        expect(list.map(d => d.host)).toEqual(['vetrade.vet', 'blackvemarket.com'])
        expect(list[1]).toMatchObject({ count: 2, txs: 1, certs: 1, last: 20, activityIds: [1, 3] })
    })
})

describe('snapshots', () => {
    beforeEach(() => localStorage.clear())

    it('give back the last value with its time', () => {
        expect(readSnapshot('x')).toBeNull()
        writeSnapshot('x', { a: 1 })
        const s = readSnapshot<{ a: number }>('x')
        expect(s?.value).toEqual({ a: 1 })
        expect(s?.at).toBeGreaterThan(0)
    })
})
