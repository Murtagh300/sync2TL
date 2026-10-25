// Client for the BlackVeMarket API (NFT holdings, NFT details, .vet names, rates).
// BlackVeMarket indexes VeChain mainnet only.
import axios from 'axios'
import { genesises } from 'src/consts'

export namespace BVM {
    export type Trait = {
        trait_type: string
        value: string
        count?: number
        percentage?: number
        traitFloor?: string
    }

    export type NFT = {
        tokenId: string
        contract: string
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

    export type Holdings = {
        holdings: NFT[]
        ownedCollections: OwnedCollection[]
        pagination: { total: number, nextOffset: number, hasMore: boolean }
        summary: { total: number, listed: number }
    }
}

// in dev the Quasar dev server proxies /bvm-api to the real API (it sends no CORS headers);
// a build can point elsewhere with BVM_API_URL
const baseURL = import.meta.env.BVM_API_URL || (import.meta.env.QUASAR_DEV ? '/bvm-api' : 'https://blackvemarket.com/api')
const http = axios.create({ baseURL, timeout: 20 * 1000 })

export const marketURL = 'https://blackvemarket.com'

export function build() {
    return {
        /** whether BlackVeMarket covers the network */
        supports(gid: string) {
            return gid === genesises.main.id
        },
        async holdings(address: string, opts: { offset?: number, limit?: number, collection?: string } = {}): Promise<BVM.Holdings> {
            const resp = await http.get<BVM.Holdings>(`/profile/${address.toLowerCase()}`, {
                params: {
                    limit: opts.limit ?? 30,
                    offset: opts.offset ?? 0,
                    status: 'all',
                    sort: 'default',
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
        /** the page of an NFT on blackvemarket.com */
        nftPage(contract: string, tokenId: string) {
            return `${marketURL}/nft/${contract}/${tokenId}`
        }
    }
}
