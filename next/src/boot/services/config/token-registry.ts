import axios from 'axios'
import vetIcon from 'assets/vet.svg'
import vthoIcon from 'assets/vtho.svg'

export type TokenRegistry = {
    updated: number
    main: TokenRegistry.Entity[]
    test: TokenRegistry.Entity[]
}

export namespace TokenRegistry {
    const url = 'https://vechain.github.io/token-registry/'

    export type Entity = {
        name: string
        symbol: string
        decimals: number
        address: string
        icon: string
        iconSrc?: string
        desc?: string
        website?: string
        links?: Record<string, string>
    }

    export const permanents: Entity[] = [
        {
            name: 'VeChain',
            symbol: 'VET',
            address: '',
            decimals: 18,
            icon: '',
            iconSrc: vetIcon
        },
        {
            symbol: 'VTHO',
            name: 'VeChain Thor',
            address: '0x0000000000000000000000000000456e65726779',
            decimals: 18,
            icon: '',
            iconSrc: vthoIcon
        }
    ]

    /**
     * the featured tokens (utils/tokens.ts FEATURED), as the registry lists them: shown on every mainnet
     * address even before the registry has loaded (or when it can't be reached)
     */
    export const featured: Entity[] = [
        { name: 'Squirtle Squad', symbol: 'SQUAD', decimals: 18, address: '0xb27a1fb87935b85cdaa2e16468247278c74c5ec7', icon: '100525d2a1fccf66732e0b518d10be34ffd20364.png' },
        { name: 'B3TR', symbol: 'B3TR', decimals: 18, address: '0x5ef79995fe8a89e0812330e4378eb2660cede699', icon: '5a9eb5e11751a649ca00298f3237c4624712af75.png', website: 'https://vebetter.com/' },
        { name: 'VOT3', symbol: 'VOT3', decimals: 18, address: '0x76ca782b59c74d088c7d2cce2f211bc00836c602', icon: 'dcc6e7f09932a389a536fe74107cd73af445dd65.png' }
    ]

    export async function fetch(): Promise<TokenRegistry> {
        const nets = ['main', 'test']
        const result = await Promise.all(nets.map(async net => {
            const resp = await axios.get<string>(`${url}${net}.json`, { transformResponse: data => data, timeout: 30 * 1000 })
            return (JSON.parse(resp.data) as TokenRegistry.Entity[]).filter(t => t.symbol !== 'VTHO')
        }))
        return {
            updated: Date.now(),
            main: result[0]!,
            test: result[1]!
        }
    }

    export function iconSrc(icon: string) {
        return `${url}assets/${icon}`
    }
}
