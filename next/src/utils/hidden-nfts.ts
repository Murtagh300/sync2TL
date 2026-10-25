import type { Service } from 'boot/services'

/**
 * NFTs out of sight: the ones the user hid, and the ones from collections BlackVeMarket
 * doesn't verify (anyone can mint those, so airdropped spam lands there). The user can
 * show an unverified one again.
 */
export type HiddenNfts = {
    /** contract:tokenId (lower case) the user hid */
    hidden: string[]
    /** contract:tokenId of unverified NFTs the user chose to show */
    shown: string[]
    /** contract:tokenId the user starred: first in the grid, and a filter of their own */
    favorites?: string[]
}

export const nftKey = (contract: string, tokenId: string) => `${contract.toLowerCase()}:${tokenId}`

export function loadHidden(svc: Service): Promise<HiddenNfts> {
    return svc.config.getJSON<HiddenNfts>('hidden-nfts', { hidden: [], shown: [] })
}

export function saveHidden(svc: Service, value: HiddenNfts) {
    return svc.config.setJSON('hidden-nfts', value)
}

export function isFavorite(h: HiddenNfts, nft: { contract: string, tokenId: string }) {
    return (h.favorites || []).includes(nftKey(nft.contract, nft.tokenId))
}

/** star or unstar an NFT; returns the new state */
export async function toggleFavorite(svc: Service, nft: { contract: string, tokenId: string }): Promise<{ prefs: HiddenNfts, favorite: boolean }> {
    const key = nftKey(nft.contract, nft.tokenId)
    const h = await loadHidden(svc)
    const list = h.favorites || []
    const favorite = !list.includes(key)
    h.favorites = favorite ? [key, ...list] : list.filter(k => k !== key)
    await saveHidden(svc, h)
    return { prefs: h, favorite }
}

/** whether an NFT stays out of the grid */
export function isHidden(h: HiddenNfts, verifiedSlugs: Set<string> | null, nft: { contract: string, tokenId: string, collectionSlug: string }) {
    const key = nftKey(nft.contract, nft.tokenId)
    if (h.hidden.includes(key)) {
        return true
    }
    const unverified = !!verifiedSlugs && !verifiedSlugs.has(nft.collectionSlug)
    return unverified && !h.shown.includes(key)
}
