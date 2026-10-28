/**
 * VeBetterDAO's X2Earn apps, for the Discover page: the apps in this round's allocation, ranked by
 * the votes they have, with name, logo and link from their IPFS metadata; and the B3TR each app paid
 * the user's addresses (the rewards pool's RewardDistributed events). Contracts from the VeBetterDAO
 * repository (mainnet).
 */
import { abi } from 'thor-devkit'
import { read, X_ALLOCATION_VOTING } from './ecosystem'

export const X2EARN_APPS = '0x8392b7ccc763db03b47afcd8e8f5e24f9cf0554d'
export const X2EARN_REWARDS_POOL = '0x6bee7ddab6c99d5b2af0554eaea484ce18f52631'
const IPFS = 'https://api.gateway-proxy.vechain.org/ipfs/'

const view = (name: string, inputs: abi.Function.Parameter[], outputs: abi.Function.Parameter[]) =>
    new abi.Function({ type: 'function', name, constant: true, payable: false, stateMutability: 'view', inputs, outputs })

const APP = { type: 'tuple[]', name: 'apps', components: [
    { type: 'bytes32', name: 'id' }, { type: 'address', name: 'teamWalletAddress' }, { type: 'string', name: 'name' },
    { type: 'string', name: 'metadataURI' }, { type: 'uint256', name: 'createdAtTimestamp' }, { type: 'bool', name: 'appAvailableForAllocationVoting' }
] } as abi.Function.Parameter

const fx = {
    apps: view('apps', [], [APP]),
    allEligibleApps: view('allEligibleApps', [], [{ type: 'bytes32[]', name: 'ids' }]),
    currentRoundId: view('currentRoundId', [], [{ type: 'uint256', name: 'round' }]),
    getAppVotes: view('getAppVotes', [{ type: 'uint256', name: 'roundId' }, { type: 'bytes32', name: 'app' }], [{ type: 'uint256', name: 'votes' }])
}

const REWARD = new abi.Event({
    type: 'event', name: 'RewardDistributed', anonymous: false,
    inputs: [
        { indexed: false, type: 'uint256', name: 'amount' }, { indexed: true, type: 'bytes32', name: 'appId' },
        { indexed: true, type: 'address', name: 'receiver' }, { indexed: false, type: 'string', name: 'proof' },
        { indexed: true, type: 'address', name: 'distributor' }
    ]
})

export type X2App = {
    id: string
    name: string
    description: string
    logo: string
    url: string
    /** votes in the current round (whole VOT3); 0 when not in it */
    votes: number
}

/** an ipfs:// link (or a bare CID) through VeChain's gateway; other links as they are */
export function ipfsUrl(uri: string): string {
    if (!uri) return ''
    if (uri.startsWith('ipfs://')) return IPFS + uri.slice(7)
    if (/^(baf|Qm)[a-zA-Z0-9]+/.test(uri)) return IPFS + uri
    return /^https:\/\//.test(uri) ? uri : ''
}

type Meta = { description?: string, logo?: string, external_url?: string }
const META_KEY = 'bv-x2-meta'
const META_DAYS = 3

function metaCache(): Record<string, { at: number, meta: Meta }> {
    try {
        return JSON.parse(localStorage.getItem(META_KEY) || '{}') as Record<string, { at: number, meta: Meta }>
    } catch {
        return {}
    }
}

async function metadata(uris: string[]): Promise<Record<string, Meta>> {
    const cache = metaCache()
    const fresh = Date.now() - META_DAYS * 86400 * 1000
    const out: Record<string, Meta> = {}
    const todo = uris.filter(u => {
        const c = cache[u]
        if (c && c.at > fresh) out[u] = c.meta
        return !out[u]
    })
    for (let i = 0; i < todo.length; i += 8) {
        await Promise.all(todo.slice(i, i + 8).map(async u => {
            try {
                const r = await fetch(ipfsUrl(u))
                if (!r.ok) return
                const m = (await r.json()) as Meta
                const meta = { description: String(m.description || '').slice(0, 400), logo: String(m.logo || ''), external_url: String(m.external_url || '') }
                out[u] = meta
                cache[u] = { at: Date.now(), meta }
            } catch {
                // no metadata: the name alone
            }
        }))
    }
    try {
        localStorage.setItem(META_KEY, JSON.stringify(cache))
    } catch { }
    return out
}

/** the apps in this round, most voted first */
export async function roundApps(thor: Connex.Thor): Promise<X2App[]> {
    const [appsD, eligibleD, roundD] = await read(thor, [
        { to: X2EARN_APPS, f: fx.apps, args: [] },
        { to: X2EARN_APPS, f: fx.allEligibleApps, args: [] },
        { to: X_ALLOCATION_VOTING, f: fx.currentRoundId, args: [] }
    ])
    const all = ((appsD?.apps || []) as { id: string, name: string, metadataURI: string }[])
    const eligible = new Set(((eligibleD?.ids || []) as string[]).map(i => i.toLowerCase()))
    const apps = all.filter(a => eligible.has(a.id.toLowerCase()))
    const round = String(roundD?.round || '0')
    const [votes, meta] = await Promise.all([
        round !== '0' ? read(thor, apps.map(a => ({ to: X_ALLOCATION_VOTING, f: fx.getAppVotes, args: [round, a.id] }))) : Promise.resolve([]),
        metadata(apps.map(a => a.metadataURI))
    ])
    return apps.map((a, i) => {
        const m = meta[a.metadataURI] || {}
        return {
            id: a.id.toLowerCase(),
            name: a.name,
            description: m.description || '',
            logo: ipfsUrl(m.logo || ''),
            url: /^https:\/\//.test(m.external_url || '') ? m.external_url! : '',
            votes: Number(BigInt(String(votes[i]?.votes || '0')) / 10n ** 18n)
        }
    }).sort((a, b) => b.votes - a.votes)
}

const pad = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0')

/** B3TR (wei) each app paid these addresses, by app id */
export async function earnedByApp(thor: Connex.Thor, addresses: string[], cap = 2048): Promise<Record<string, bigint>> {
    const out: Record<string, bigint> = {}
    if (!addresses.length) return out
    const filter = thor.filter('event', addresses.map(a => ({ address: X2EARN_REWARDS_POOL, topic0: REWARD.signature, topic2: pad(a) })))
    for (let offset = 0; offset < cap; offset += 256) {
        const page = await filter.order('desc').apply(offset, 256)
        for (const e of page) {
            try {
                const d = REWARD.decode(e.data, e.topics)
                const id = String(d.appId).toLowerCase()
                out[id] = (out[id] || 0n) + BigInt(String(d.amount))
            } catch { }
        }
        if (page.length < 256) break
    }
    return out
}
