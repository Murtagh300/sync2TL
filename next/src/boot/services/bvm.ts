// Client for the BlackVeMarket API (NFT holdings, NFT details, .vet names, rates).
// BlackVeMarket indexes VeChain mainnet only.
import { createClient } from 'src/utils/net'
import { bvmDirectUrl, bvmPublicUrl } from 'src/utils/endpoints'
import { genesises } from 'src/consts'

export namespace BVM {
    export type Trait = {
        trait_type: string
        value: string
        count?: number
        percentage?: number
        traitFloor?: string
    }

    /** an offer on an NFT, made through its collection's marketplace contract */
    export type Offer = {
        id: string
        index: number
        /** 'listing': made on a live listing (saleId), otherwise a blind offer on the NFT */
        type: string
        isListed: boolean
        saleId: string | null
        buyer: string
        amount: string
        displayAmount: string
        currency: string
        paymentToken: string
        date: string
    }

    export type NFT = {
        tokenId: string
        contract: string
        /** the collection's marketplace contract; the zero address when it trades nowhere */
        maasContract?: string | null
        saleId?: string | null
        seller?: string | null
        paymentToken?: string | null
        /** the listing price in wei of paymentToken */
        rawPrice?: string | null
        /** the listing price as text ("60 VET"), or "Unlisted" */
        price?: string
        offers?: Offer[]
        offerCount?: number
        collectionSlug: string
        collection: string
        name: string
        image: string
        rank: number | null
        traits: Trait[]
        owner: string
        listed: boolean
        displayPrice: string | null
        currency: string | null
        tokenStandard: 'erc721' | 'erc1155' | string
        description?: string | null
        intelligence?: {
            lastSale?: { displayPrice: string, currency: string, timestamp?: string } | null
            bestOffer?: { displayAmount?: string, currency?: string } | null
            collection?: { floor: string, floorValue: number | null, floorCurrency: string | null } | null
        } | null
    }

    export type OwnedCollection = {
        slug: string
        name: string
        count: number
        image: string
        floorAmount: number | null
        floorCurrency: string | null
    }

    export type Collection = {
        slug: string
        name: string
        nftContract: string
        maasContract: string
        coverImage: string
        floorValue: number | null
        floorCurrency: string
        /** NFTs listed for sale now */
        listedCount?: number
        /** sales in the last 30 days */
        salesMonth?: number
    }

    export type LaunchPhase = {
        /** the phase id the contract's mint(phaseId, quantity) takes */
        index: number
        label: string
        kind: 'public' | 'allowlist' | string
        state: 'live' | 'upcoming' | 'ended' | string
        start: string | null
        end: string | null
        priceWei: string
        /** the token paid with; null is VET */
        payToken: string | null
        paySymbol: string
        perWallet: number
        /** a price that changes as the phase sells; the wallet leaves those to the site */
        steps: unknown[]
        gates: unknown[]
        burnToken: string | null
    }

    export type Launch = {
        id: string
        slug: string
        name: string
        description: string
        coverImage: string
        bannerImage?: string
        contractAddress: string
        maxSupply: number
        publicSupply: number
        publicMinted: number
        mintedCount: number
        minPriceSymbol?: string
        minPriceWei?: string
        state?: string
        soldOut?: boolean
        mintPaused?: boolean
        nextChangeAt?: string | null
        phases?: LaunchPhase[]
        [k: string]: unknown
    }

    /** a market event: a new listing, a sale or an offer */
    export type FeedItem = {
        kind: 'listing' | 'sale' | 'offer'
        id: string
        name: string
        image: string
        contract: string
        tokenId: string
        collection: string
        collectionSlug: string
        price: string
        time: number
    }

    export type CollectionSummary = {
        collection: Collection & { description?: string, bannerImage?: string }
        floor: string
        floorValue: number | null
        listedCount: number
        offers: number
        totalSupply: number
        owners: number
        volume: { total: string, vetLabel?: string }
        sales: { total: number }
    }

    export type CollectionPage = {
        summary: CollectionSummary
        items: NFT[]
        pagination: { total: number, nextOffset: number, hasMore: boolean }
    }

    /** an offer on any NFT of a collection (BlackVeMarket offers contract) */
    export type CollectionOffer = {
        id: string
        offerId: string
        buyer: string
        pricePerItem: string
        displayAmount: string
        currency: string
        paymentToken: string
        quantity: number
        filled?: number
        expiresAt?: string | number
    }

    export type ActivityEntry = {
        action: string
        actionLabel?: string
        buyer?: string | null
        seller?: string | null
        displayAmount?: string
        currency?: string
        timestamp?: string
    }

    export type DelegateStatus = { enabled: boolean, genesis: boolean, free: boolean, remainingTx: number }

    export type Profile = {
        displayName: string
        /** the NFT chosen as avatar on blackvemarket.com */
        avatar: string
    }

    export type Holdings = {
        holdings: NFT[]
        ownedCollections: OwnedCollection[]
        pagination: { total: number, nextOffset: number, hasMore: boolean }
        summary: { total: number, listed: number, offers?: number }
    }
}

// public data, through the server's gateway when there is one (see utils/endpoints.ts)
const http = createClient({ baseURL: bvmPublicUrl })

export const marketURL = 'https://blackvemarket.com'

let collectionsCache: { at: number, value: Record<string, BVM.Collection> } | null = null
let collectionsLoading: Promise<Record<string, BVM.Collection>> | null = null
const profileCache = new Map<string, Promise<BVM.Profile | null>>()
const floorCache = new Map<string, { at: number, points: Promise<{ time: number, value: number, currency: string }[]> }>()

async function loadCollections() {
    const resp = await http.get<{ items: { collection: BVM.Collection, floorValue: number | null, floor: string, listedCount?: number, sales?: { monthly?: number } }[] }>('/collections')
    const value: Record<string, BVM.Collection> = {}
    for (const item of resp.data.items || []) {
        const c = item.collection
        value[c.nftContract.toLowerCase()] = {
            ...c,
            floorValue: item.floorValue,
            // "0.65 VET"
            floorCurrency: (item.floor || '').split(' ')[1] || 'VET',
            listedCount: item.listedCount || 0,
            salesMonth: item.sales?.monthly || 0
        }
    }
    collectionsCache = { at: Date.now(), value }
    return value
}

export function build() {
    return {
        /** whether BlackVeMarket covers the network */
        supports(gid: string) {
            return gid === genesises.main.id
        },
        async holdings(address: string, opts: { offset?: number, limit?: number, collection?: string, sort?: string, status?: string } = {}): Promise<BVM.Holdings> {
            const resp = await http.get<BVM.Holdings>(`/profile/${address.toLowerCase()}`, {
                params: {
                    limit: opts.limit ?? 30,
                    offset: opts.offset ?? 0,
                    status: opts.status || 'all',
                    sort: opts.sort || 'default',
                    ...(opts.collection ? { collection: opts.collection } : {})
                }
            })
            return resp.data
        },
        async nft(contract: string, tokenId: string): Promise<BVM.NFT> {
            const resp = await http.get<{ nft: BVM.NFT }>(`/nft/${contract}/${tokenId}`)
            return resp.data.nft
        },
        async vetName(address: string): Promise<string> {
            const resp = await http.get<{ vetName: string | null }>(`/wallet/${address.toLowerCase()}/vet-name`)
            return resp.data.vetName || ''
        },
        /** the collections BlackVeMarket trades, by NFT contract (lower case); cached for 10 minutes */
        collections(): Promise<Record<string, BVM.Collection>> {
            if (collectionsCache && collectionsCache.at > Date.now() - 10 * 60 * 1000) {
                return Promise.resolve(collectionsCache.value)
            }
            // callers asking at the same time share one request
            collectionsLoading = collectionsLoading || loadCollections().finally(() => { collectionsLoading = null })
            return collectionsLoading
        },
        /** recent listings, sales and offers, newest first; for one collection when given */
        async activity(collection?: string, limit = 12): Promise<BVM.FeedItem[]> {
            type Raw = Record<string, string | null | undefined>
            const resp = await http.get<Record<'listings' | 'sales' | 'offers', Raw[]>>('/activity', {
                params: { limit, ...(collection ? { collection } : {}) }
            })
            const read = (kind: BVM.FeedItem['kind'], r: Raw): BVM.FeedItem => ({
                kind,
                id: `${kind}:${r.id}`,
                name: r.name || `#${r.tokenId}`,
                image: r.image || '',
                contract: r.contract || '',
                tokenId: r.tokenId || '',
                collection: r.collection || '',
                collectionSlug: r.collectionSlug || '',
                price: kind === 'listing' ? (r.price || '') : `${r.displayAmount || ''} ${r.currency || ''}`.trim(),
                time: Date.parse(r.timestamp || r.listedAt || '') || 0
            })
            const d = resp.data
            return [
                ...(d.listings || []).map(r => read('listing', r)),
                ...(d.sales || []).map(r => read('sale', r)),
                ...(d.offers || []).map(r => read('offer', r))
            ].sort((a, b) => b.time - a.time)
        },
        /** the name and avatar an address set on blackvemarket.com; cached per session */
        async profile(address: string): Promise<BVM.Profile | null> {
            const a = address.toLowerCase()
            if (!profileCache.has(a)) {
                profileCache.set(a, http.get<{ profile?: { display_name?: string | null } | null, avatarItem?: { image?: string } | null }>(`/profile/${a}`, {
                    params: { limit: 1, offset: 0, status: 'all', sort: 'default' }
                }).then(r => ({
                    displayName: r.data.profile?.display_name || '',
                    avatar: r.data.avatarItem?.image || ''
                })).catch(() => null))
            }
            return profileCache.get(a)!
        },
        /** the NFTs an address has listed */
        async listings(address: string, limit = 12): Promise<BVM.NFT[]> {
            const resp = await http.get<BVM.Holdings>(`/profile/${address.toLowerCase()}`, {
                params: { limit, offset: 0, status: 'listed', sort: 'default' }
            })
            return resp.data.holdings.filter(n => n.listed)
        },
        /** the collection page on blackvemarket.com */
        collectionPage(slug: string) {
            return `${marketURL}/collection/${slug}`
        },
        /** a collection: its numbers and a page of its NFTs */
        async collection(slug: string, opts: { offset?: number, limit?: number, status?: 'all' | 'listed', sort?: string } = {}): Promise<BVM.CollectionPage> {
            const resp = await http.get<BVM.CollectionPage>(`/collection/${encodeURIComponent(slug)}`, {
                params: { limit: opts.limit ?? 30, offset: opts.offset ?? 0, ...(opts.status === 'listed' ? { status: 'listed' } : {}), ...(opts.sort ? { sort: opts.sort } : {}) }
            })
            return resp.data
        },
        /** the floor per day (about the last month), oldest first; cached 30 minutes */
        floorHistory(slug: string): Promise<{ time: number, value: number, currency: string }[]> {
            const hit = floorCache.get(slug)
            if (hit && hit.at > Date.now() - 30 * 60 * 1000) {
                return hit.points
            }
            const points = http.get<{ items: { date: string, displayAmount: string, currency: string }[] }>(`/collection/${encodeURIComponent(slug)}/floor-history`)
                .then(r => (r.data.items || [])
                    .map(i => ({ time: Date.parse(i.date), value: parseFloat(String(i.displayAmount).replace(/,/g, '')), currency: i.currency }))
                    .filter(p => isFinite(p.time) && isFinite(p.value) && p.value > 0)
                    .sort((a, b) => a.time - b.time))
            points.catch(() => floorCache.delete(slug))
            floorCache.set(slug, { at: Date.now(), points })
            return points
        },
        async collectionOffers(slug: string): Promise<{ enabled: boolean, offers: BVM.CollectionOffer[] }> {
            const resp = await http.get<{ enabled: boolean, offers: BVM.CollectionOffer[] }>(`/collection/${encodeURIComponent(slug)}/collection-offers`)
            return resp.data
        },
        /** an NFT with its history (listings, sales, offers) */
        async nftWithActivity(contract: string, tokenId: string): Promise<{ nft: BVM.NFT, activity: BVM.ActivityEntry[] }> {
            const resp = await http.get<{ nft: BVM.NFT, activity: BVM.ActivityEntry[] }>(`/nft/${contract}/${tokenId}`)
            return { nft: resp.data.nft, activity: resp.data.activity || [] }
        },
        /** launches open for minting, or about to open */
        async launches(): Promise<BVM.Launch[]> {
            const resp = await http.get<{ live?: BVM.Launch[], upcoming?: BVM.Launch[] }>('/launchpad/public')
            return [...(resp.data.live || []), ...(resp.data.upcoming || [])]
        },
        /** whether BlackVeMarket pays the gas of this wallet's marketplace transactions */
        async delegateStatus(address: string): Promise<BVM.DelegateStatus> {
            try {
                const resp = await http.get<BVM.DelegateStatus>('/delegate/status', { params: { wallet: address.toLowerCase() } })
                return resp.data
            } catch {
                return { enabled: false, genesis: false, free: false, remainingTx: 0 }
            }
        },
        /** the fee delegation service, for options.delegator */
        delegatorURL() {
            // signed by BlackVeMarket itself, never through the gateway
            return new URL(bvmDirectUrl.replace(/\/$/, '') + '/delegate/sign', window.location.href).href
        },
        /** the page of an NFT on blackvemarket.com */
        nftPage(contract: string, tokenId: string) {
            return `${marketURL}/nft/${contract}/${tokenId}`
        }
    }
}
