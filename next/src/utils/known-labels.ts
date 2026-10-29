import { reactive } from 'vue'

/**
 * Names for well-known addresses, wherever an address is shown: VeChain's own contracts, the
 * VeBetterDAO and StarGate contracts the wallet uses, and every token and NFT collection in
 * VeChain's registries (github.com/vechain/token-registry and nft-registry), loaded once a day.
 * Only sources that publish the address with its owner: exchange wallets aren't named, as no
 * one publishes those for VeChain.
 */

const STATIC: Record<string, string> = {
    '0x0000000000000000000000000000456e65726779': 'VTHO',
    '0x00000000000000000000000000005374616b6572': 'VeChain staking',
    '0x0000000000000000000000000000506172616d73': 'VeChain params',
    '0x0000000000000000000000417574686f72697479': 'VeChain authority',
    '0x0000000000000000000000004578656375746f72': 'VeChain executor',
    '0x000000000000000000000050726f746f74797065': 'VeChain prototype',
    '0x03c557be98123fdb6fad325328ac6eb77de7248c': 'StarGate',
    '0x1856c533ac2d94340aaa8544d35a5c1d4a21dee7': 'StarGate NFT',
    '0x5ef79995fe8a89e0812330e4378eb2660cede699': 'B3TR',
    '0x76ca782b59c74d088c7d2cce2f211bc00836c602': 'VOT3',
    '0x89a00bb0947a30ff95beef77a66aede3842fe5b7': 'VeBetterDAO voting',
    '0x6bee7ddab6c99d5b2af0554eaea484ce18f52631': 'VeBetterDAO rewards',
    '0x8392b7ccc763db03b47afcd8e8f5e24f9cf0554d': 'VeBetterDAO apps',
    '0x1c65c25fabe2fc1bcb82f253fa0c916a322f777c': 'VeBetterDAO governance',
    '0x07479f2710d16a0bacbe6c25b9b32447364c0a33': 'vet.domains',
    '0xabac49445584c8b6c1472b030b1076ac3901d7cf': 'vet.domains'
}

const KEY = 'bv-known-labels'
const DAY = 86400 * 1000

const state = reactive({ registry: {} as Record<string, string> })

function cached(): { at: number, labels: Record<string, string> } | null {
    try {
        return JSON.parse(localStorage.getItem(KEY) || 'null') as { at: number, labels: Record<string, string> } | null
    } catch {
        return null
    }
}

/** registry entries as labels: a token by its symbol, a collection by its name */
export function registryLabels(tokens: { address?: string, symbol?: string }[], nfts: { address?: string, name?: string }[]): Record<string, string> {
    const out: Record<string, string> = {}
    const ok = (a: unknown): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)
    // printable text only: a name is shown as text, never as markup
    const clean = (s: unknown) => [...String(s || '')].filter(c => c >= ' ' && c !== '<' && c !== '>').join('').trim().slice(0, 40)
    for (const n of nfts) if (ok(n.address) && clean(n.name)) out[n.address.toLowerCase()] = clean(n.name)
    for (const t of tokens) if (ok(t.address) && clean(t.symbol)) out[t.address.toLowerCase()] = clean(t.symbol)
    return out
}

let loading: Promise<void> | null = null

/** the registries, once a day (from the cache in between) */
export function loadKnownLabels(): Promise<void> {
    const c = cached()
    if (c) state.registry = c.labels
    if (c && Date.now() - c.at < DAY) return Promise.resolve()
    loading = loading || (async () => {
        try {
            const [tokens, nfts] = await Promise.all([
                fetch('https://vechain.github.io/token-registry/main.json').then(r => r.json()),
                fetch('https://vechain.github.io/nft-registry/main.json').then(r => r.json())
            ]) as [{ address?: string, symbol?: string }[], { address?: string, name?: string }[]]
            const labels = registryLabels(Array.isArray(tokens) ? tokens : [], Array.isArray(nfts) ? nfts : [])
            state.registry = labels
            try {
                localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), labels }))
            } catch { }
        } catch {
            // offline: the static names and the last copy
        } finally {
            loading = null
        }
    })()
    return loading
}

/** a public name for an address, or '' (reactive) */
export function knownLabel(address: string): string {
    const a = address.toLowerCase()
    return STATIC[a] || state.registry[a] || ''
}
