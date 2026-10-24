import { beforeEach, describe, expect, it } from 'vitest'
import { watchEffect } from 'vue'
import { Storage } from 'core/storage'
import * as Config from 'src/boot/services/config'
import * as Wallet from 'src/boot/services/wallet'
import * as Activity from 'src/boot/services/activity'
import { genesises } from 'src/consts'

let storage: Storage
let config: ReturnType<typeof Config.build>
let wallet: ReturnType<typeof Wallet.build>
let activity: ReturnType<typeof Activity.build>

beforeEach(async () => {
    storage = await Storage.init()
    await storage.configs.delete({})
    await storage.wallets.delete({})
    await storage.activities.delete({})
    // a fresh registry keeps token.all() from fetching it over the network
    await storage.configs.insert({
        key: 'tokenRegistry',
        subKey: '',
        value: JSON.stringify({
            updated: Date.now(),
            main: [{ name: 'Token A', symbol: 'TKA', decimals: 18, address: '0xa', icon: 'a.png' }],
            test: []
        })
    }, true)
    config = Config.build(storage)
    wallet = Wallet.build(storage)
    activity = Activity.build(storage)
})

/** resolves once the reactive effect has run `times` times */
function effectRuns(fn: () => unknown, times: number) {
    let runs = 0
    return new Promise<void>(resolve => {
        const stop = watchEffect(() => {
            fn()
            if (++runs === times) {
                queueMicrotask(() => stop())
                resolve()
            }
        }, { flush: 'sync' })
    })
}

describe('config.node', () => {
    it('lists the working vechain.org nodes first, then user nodes', async () => {
        await config.node.save([{ genesis: genesises.test, url: 'https://my.node' }])
        const all = await config.node.all()
        expect(all.map(n => n.url)).toEqual([
            'https://mainnet.vechain.org',
            'https://mainnet.vecha.in',
            'https://testnet.vechain.org',
            'https://testnet.vecha.in',
            'https://my.node'
        ])
        expect(all.some(n => n.url.includes('veblocks'))).toBe(false)
    })

    it('never stores the preset nodes', async () => {
        await config.node.save(await config.node.all())
        const [row] = await storage.configs.all().where({ key: 'nodes', subKey: '' }).query()
        expect(JSON.parse(row!.value)).toEqual([])
    })

    it('keeps the active node per network', async () => {
        await config.node.saveActiveMap({ [genesises.main.id]: 'https://mainnet.vecha.in' })
        expect(await config.node.activeMap()).toEqual({ [genesises.main.id]: 'https://mainnet.vecha.in' })
    })
})

describe('config.token', () => {
    it('combines VET/VTHO for every network with the registry', async () => {
        const tokens = await config.token.all()
        const main = tokens.filter(t => t.gid === genesises.main.id).map(t => t.symbol)
        const test = tokens.filter(t => t.gid === genesises.test.id).map(t => t.symbol)
        expect(main).toEqual(['VET', 'VTHO', 'TKA'])
        expect(test).toEqual(['VET', 'VTHO'])

        const tka = tokens.find(t => t.symbol === 'TKA')!
        expect(tka.permanent).toBe(false)
        expect(tka.iconSrc).toBe('https://vechain.github.io/token-registry/assets/a.png')
    })

    it('stores active symbols without duplicates', async () => {
        await config.token.saveActiveSymbols(['TKA', 'TKA', 'TKB'])
        expect(await config.token.activeSymbols()).toEqual(['TKA', 'TKB'])
    })
})

describe('config values', () => {
    it('keeps recent recipients per network', async () => {
        await config.saveRecentRecipients(genesises.main.id, ['0x1'])
        expect(await config.getRecentRecipients(genesises.main.id)).toEqual(['0x1'])
        expect(await config.getRecentRecipients(genesises.test.id)).toEqual([])
    })

    it('stores language, master key glob and the biometric flag', async () => {
        await config.saveLanguage('zh-cn')
        await config.setUserMasterKeyGlob('{"glob":1}')
        await config.setBioPassOn(true)
        expect(await config.getLanguage()).toBe('zh-cn')
        expect(await config.getUserMasterKeyGlob()).toBe('{"glob":1}')
        expect(await config.getBioPassOn()).toBe(true)
        await config.setBioPassOn(false)
        expect(await config.getBioPassOn()).toBe(false)
    })
})

describe('wallet', () => {
    it('stores wallets and maps meta', async () => {
        const meta: M.Wallet.Meta = { name: 'W', type: 'ledger', addresses: ['0x1'] }
        const id = await wallet.insert({ gid: genesises.main.id, vault: 'v', meta })
        expect(await wallet.get(id)).toEqual({ id, gid: genesises.main.id, vault: 'v', meta })
        expect(await wallet.getByGid(genesises.test.id)).toEqual([])

        await wallet.update(id, { ...meta, name: 'Renamed' })
        expect((await wallet.get(id))!.meta.name).toBe('Renamed')

        await wallet.delete(id)
        expect(await wallet.get(id)).toBeNull()
    })

    it('treats wallets saved without a type as HD wallets', async () => {
        // rows written by early Sync2 versions have no meta.type
        const id = await storage.wallets.insert({ gid: 'g', vault: 'v', meta: JSON.stringify({ name: 'Old', addresses: [] }) })
        expect((await wallet.get(id))!.meta.type).toBe('hd')
    })
})

describe('activity', () => {
    const tx = (createdTime: number): M.Activity<'id?'> => ({
        gid: 'g',
        walletId: 1,
        createdTime,
        status: '',
        type: 'tx',
        glob: { id: '0x1', encoded: '', signer: '0xs', origin: '', link: '', comment: 'c', receipt: null }
    })

    it('pages newest first and lists uncompleted ones', async () => {
        const first = await activity.add(tx(1))
        await activity.add(tx(2))
        await activity.add(tx(3))
        await activity.update(first, { status: 'completed' })

        expect((await activity.page(2, 0)).map(a => a.createdTime)).toEqual([3, 2])
        expect((await activity.uncompleted()).map(a => a.createdTime)).toEqual([2, 3])
        expect((await activity.page(10, 0))[2]!.glob).toEqual(tx(1).glob)
    })
})

describe('reactivity', () => {
    it('re-runs effects that queried a table when the table changes', async () => {
        const rerun = effectRuns(() => { void wallet.all() }, 2)
        await wallet.insert({ gid: 'g', vault: 'v', meta: { name: 'W', type: 'hd', addresses: [] } })
        await rerun
    })

    it('does not re-run for changes to other tables', async () => {
        let runs = 0
        const stop = watchEffect(() => { void wallet.all(); runs++ }, { flush: 'sync' })
        await activity.add({
            gid: 'g', walletId: 1, createdTime: 1, status: '', type: 'cert',
            glob: { id: '0x1', encoded: '', signer: '', origin: '', link: '' }
        })
        await new Promise(resolve => setTimeout(resolve, 20))
        stop()
        expect(runs).toBe(1)
    })
})
