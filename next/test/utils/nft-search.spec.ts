import { describe, it, expect } from 'vitest'
import { nftMatches } from 'src/utils/nft-search'

const nft = { name: 'Saltwater Skirmisher Vale', collection: 'Squad Trading Cards', tokenId: '38' }

describe('NFT search', () => {
    it('finds by words from the name or collection, in any order and case', () => {
        expect(nftMatches(nft, 'vale squad')).toBe(true)
        expect(nftMatches(nft, 'SALTWATER')).toBe(true)
        expect(nftMatches(nft, 'vale dragon')).toBe(false)
    })

    it('finds by token id, and #id exactly', () => {
        expect(nftMatches(nft, '38')).toBe(true)
        expect(nftMatches(nft, '#38')).toBe(true)
        expect(nftMatches(nft, '#3')).toBe(false)
    })

    it('finds by your own label, and an empty search shows everything', () => {
        expect(nftMatches(nft, 'keep', 'Keep')).toBe(true)
        expect(nftMatches(nft, '   ')).toBe(true)
    })
})
