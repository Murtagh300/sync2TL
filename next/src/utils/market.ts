import { fns, ZERO_ADDRESS } from './actions'

/**
 * Transactions for BlackVeMarket, the same clauses blackvemarket.com builds:
 * each collection trades on its own marketplace contract (maasContract).
 */

export type Clause = { to: string, value: string, data: string, comment?: string }

export type MarketNft = {
    contract: string
    tokenId: string
    maasContract?: string | null
    tokenStandard?: string
    saleId?: string | null
    listed?: boolean
}

/** the payment tokens a listing can ask for, by symbol (VET is native) */
export const listingCurrencies: Record<string, string> = {
    VET: ZERO_ADDRESS,
    B3TR: '0x5ef79995FE8a89e0812330E4378eB2660ceDe699',
    SQUAD: '0xb27a1fb87935b85cdaa2e16468247278c74c5ec7',
    GOLD: '0xFF3BC357600885aAA97506ea6e24fB21abA88fbD',
    VENI: '0x0Bf03B87B2BDd0b3907657115832Ec6DA5193305'
}

export function canTrade(nft: MarketNft) {
    return !!nft.maasContract && nft.maasContract !== ZERO_ADDRESS
}

/** list NFTs at one price each: approve each collection's market once, then list */
export function listClauses(nfts: MarketNft[], priceWei: string, paymentToken: string): Clause[] {
    const approvals: Clause[] = []
    const seen = new Set<string>()
    for (const n of nfts) {
        const key = `${n.contract.toLowerCase()}:${n.maasContract!.toLowerCase()}`
        if (!seen.has(key)) {
            seen.add(key)
            approvals.push({ to: n.contract, value: '0', data: fns.setApprovalForAll.encode(n.maasContract!, true) })
        }
    }
    const lists = nfts.map(n => ({
        to: n.maasContract!,
        value: '0',
        // fixed price: minimum and buy-now price the same, no end date
        data: n.tokenStandard === 'erc1155'
            ? fns.createAuctionSale1155.encode(n.contract, n.tokenId, 1, priceWei, priceWei, 0, paymentToken)
            : fns.createAuctionSale.encode(n.contract, n.tokenId, priceWei, priceWei, 0, paymentToken)
    }))
    return [...approvals, ...lists]
}

export function cancelListingClauses(nfts: MarketNft[]): Clause[] {
    return nfts.map(n => ({ to: n.maasContract!, value: '0', data: fns.cancelSale.encode(n.saleId!) }))
}

/** a new price: cancel the listing and list again */
export function repriceClauses(nft: MarketNft, priceWei: string, paymentToken: string): Clause[] {
    return [...cancelListingClauses([nft]), ...listClauses([nft], priceWei, paymentToken).slice(1)]
}

/** accept an offer: let the market take this one NFT, then accept */
export function acceptOfferClauses(nft: MarketNft, offer: { isListed: boolean, saleId: string | null, index: number }): Clause[] {
    return [
        { to: nft.contract, value: '0', data: fns.approve.encode(nft.maasContract!, nft.tokenId) },
        offer.isListed && offer.saleId
            ? { to: nft.maasContract!, value: '0', data: fns.acceptOffer.encode(offer.saleId, offer.index) }
            : { to: nft.maasContract!, value: '0', data: fns.acceptBlindOffer.encode(nft.contract, nft.tokenId, offer.index) }
    ]
}

/** send NFTs to one address */
export function sendClauses(nfts: MarketNft[], from: string, to: string): Clause[] {
    return nfts.map(n => ({
        to: n.contract,
        value: '0',
        data: n.tokenStandard === 'erc1155'
            ? fns.safeTransferFrom1155.encode(from, to, n.tokenId, 1, '0x')
            : fns.transferFrom.encode(from, to, n.tokenId)
    }))
}

/** mint from a launchpad phase, paid in VET or in a token */
export function mintClauses(contract: string, phaseIndex: number, quantity: number, priceWei: string, payToken: string | null): Clause[] {
    const total = (BigInt(priceWei) * BigInt(quantity)).toString()
    const mint = fns.mint.encode(phaseIndex, quantity)
    if (!payToken || payToken === ZERO_ADDRESS) {
        return [{ to: contract, value: total, data: mint }]
    }
    return [
        { to: payToken, value: '0', data: fns.approve.encode(contract, total) },
        { to: contract, value: '0', data: mint }
    ]
}

type SignTx = (gid: string, req: M.TxRequest) => Promise<M.TxResponse>
type Bvm = {
    delegateStatus(address: string): Promise<{ enabled: boolean, genesis: boolean }>
    delegatorURL(): string
}

/**
 * sign a marketplace transaction; BlackVeMarket pays the gas when it sponsors the
 * wallet (genesis holders), as it does on the site
 */
export async function signMarketTx(signTx: SignTx, bvm: Bvm, gid: string, signer: string, clauses: Clause[], comment: string) {
    const status = await bvm.delegateStatus(signer)
    const sponsored = status.enabled && status.genesis
    return signTx(gid, {
        message: clauses.map(c => ({ ...c, comment })),
        options: {
            signer,
            comment,
            ...(sponsored ? { delegator: { url: bvm.delegatorURL() } } : {})
        }
    })
}
