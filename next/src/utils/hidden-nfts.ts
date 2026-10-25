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
}

export const nftKey = (contract: string, tokenId: string) => `${contract.toLowerCase()}:${tokenId}`

export function loadHidden(svc: Service): Promise<HiddenNfts> {
    return svc.config.getJSON<HiddenNfts>('hidden-nfts', { hidden: [], shown: [] })
}

export function saveHidden(svc: Service, value: HiddenNfts) {
    return svc.config.setJSON('hidden-nfts', value)
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
