/**
 * Searching your NFTs: every word typed must appear in the name, the collection, the token id or
 * your own label, in any order and any case. "#12" finds token 12 exactly.
 */
export type Searchable = { name?: string, collection?: string, tokenId: string }

export function nftMatches(nft: Searchable, query: string, label = ''): boolean {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return true
    const text = `${nft.name || ''} ${nft.collection || ''} ${label}`.toLowerCase()
    return words.every(w => {
        if (/^#\d+$/.test(w)) return nft.tokenId === w.slice(1)
        return text.includes(w) || nft.tokenId === w
    })
}
