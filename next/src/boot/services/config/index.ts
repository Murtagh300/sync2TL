import { Storage } from 'core/storage'
import { delegateTable } from '../utils'
import { genesises } from 'src/consts'
import { TokenRegistry } from './token-registry'
import { unique } from 'src/utils/array'
import { setContacts, type Contact } from 'src/utils/names'

// the first node per network is the default; veblocks.net nodes are gone
const presetNodes: M.Node[] = [
    { // mainnet
        genesis: genesises.main,
        preset: true,
        url: 'https://mainnet.vechain.org'
    },
    { // mainnet
        genesis: genesises.main,
        preset: true,
        url: 'https://mainnet.vecha.in'
    },
    { // testnet
        genesis: genesises.test,
        preset: true,
        url: 'https://testnet.vechain.org'
    },
    { // testnet
        genesis: genesises.test,
        preset: true,
        url: 'https://testnet.vecha.in'
    }
]

export function build(storage: Storage) {
    const t = delegateTable<Storage.ConfigEntity, Storage.ConfigEntity>(
        storage.configs,
        e => e,
        m => m
    )
    type Key = 'nodes' | 'activeNodeMap' | 'userMasterKeyGlob' |
        'tokenRegistry' | 'activeTokenSymbols' | 'recentRecipients' | 'language' | 'bio-pass-on' | 'contacts' | 'watchlist' | 'alerts' | 'alert-state'

    const getSubKey = async (key: Key, subKey: string) => {
        const row = (await t.all().where({ key, subKey }).query())[0]
        return row ? row.value : ''
    }
    const setSubKey = (key: Key, subKey: string, value: string) => {
        return t.insert({ key, subKey, value }, true).then(() => { })
    }

    const get = (key: Key) => getSubKey(key, '')
    const set = (key: Key, value: string) => setSubKey(key, '', value)

    const node = {
        async all(): Promise<M.Node[]> {
            // prepend preset nodes
            return [
                ...JSON.parse(JSON.stringify(presetNodes)),
                ...JSON.parse(await get('nodes') || '[]')
            ]
        },
        save(val: M.Node[]) {
            // exclude preset nodes
            return set('nodes', JSON.stringify(val.filter(n => !n.preset)))
        },
        async activeMap() {
            return JSON.parse(await get('activeNodeMap') || '{}') as Record<string, string>
        },
        saveActiveMap(val: Record<string, string>) {
            return set('activeNodeMap', JSON.stringify(val))
        }
    }

    const token = {
        async all(): Promise<M.TokenSpec[]> {
            const [json, nodes] = await Promise.all([get('tokenRegistry'), node.all()])
            const registry: TokenRegistry = json ? JSON.parse(json) : {
                updated: 0,
                main: [],
                test: []
            }
            // refreshed hourly, so new tokens show up soon after they are listed
            if (registry.updated + 60 * 60 * 1000 < Date.now()) {
                // fetch in background and don't block
                TokenRegistry.fetch()
                    .then(r => set('tokenRegistry', JSON.stringify(r)))
                    .catch(err => console.warn(err))
            }

            const toModel = (gid: string, entity: TokenRegistry.Entity, permanent: boolean): M.TokenSpec => {
                return {
                    gid,
                    name: entity.name,
                    symbol: entity.symbol,
                    decimals: entity.decimals,
                    address: entity.address,
                    iconSrc: entity.iconSrc || TokenRegistry.iconSrc(entity.icon),
                    permanent
                }
            }

            const gids = unique(nodes.map(n => n.genesis.id))
            return ([] as M.TokenSpec[]).concat(
                ...gids.map(gid => TokenRegistry.permanents.map(e => toModel(gid, e, true))),
                registry.main.map(e => toModel(genesises.main.id, e, false)),
                registry.test.map(e => toModel(genesises.test.id, e, false))
            )
        },
        async activeSymbols() {
            return JSON.parse((await get('activeTokenSymbols')) || '[]') as string[]
        },
        saveActiveSymbols(val: string[]) {
            val = Array.from(new Set(val))
            return set('activeTokenSymbols', JSON.stringify(val))
        }
    }
    return {
        get node() { return node },
        get token() { return token },
        getUserMasterKeyGlob() {
            return get('userMasterKeyGlob')
        },
        setUserMasterKeyGlob(val: string) {
            return set('userMasterKeyGlob', val)
        },
        getRecentRecipients(gid: string) {
            return getSubKey('recentRecipients', gid).then(r => JSON.parse(r || '[]') as string[])
        },
        saveRecentRecipients(gid: string, val: string[]) {
            return setSubKey('recentRecipients', gid, JSON.stringify(val))
        },
        /** the address book, shared by all networks */
        async getContacts(): Promise<Contact[]> {
            return JSON.parse(await get('contacts') || '[]') as Contact[]
        },
        async saveContacts(list: Contact[]) {
            await set('contacts', JSON.stringify(list))
            setContacts(list)
        },
        /** small JSON settings: the watchlist, price alerts and what they last saw */
        async getJSON<T>(key: 'watchlist' | 'alerts' | 'alert-state', fallback: T): Promise<T> {
            const raw = await get(key)
            try {
                return raw ? JSON.parse(raw) as T : fallback
            } catch {
                return fallback
            }
        },
        setJSON(key: 'watchlist' | 'alerts' | 'alert-state', value: unknown) {
            return set(key, JSON.stringify(value))
        },
        getLanguage() {
            return get('language')
        },
        saveLanguage(lang: string) {
            return set('language', lang)
        },
        getBioPassOn() {
            return get('bio-pass-on').then(r => !!r)
        },
        setBioPassOn(on: boolean) {
            return set('bio-pass-on', on ? 't' : '')
        }
    }
}
