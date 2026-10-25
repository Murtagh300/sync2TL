import { defineBoot } from '#q-app'
import { Storage } from 'core/storage'
import * as Blockchain from './blockchain'
import * as Config from './config'
import * as Wallet from './wallet'
import * as Activity from './activity'
import * as Bvm from './bvm'
import { groupBy } from 'src/utils/array'
import { configureNames, setContacts } from 'src/utils/names'
import { genesises } from 'src/consts'

export type Service = {
    bc: ReturnType<typeof Blockchain.build>
    config: ReturnType<typeof Config.build>
    wallet: ReturnType<typeof Wallet.build>
    activity: ReturnType<typeof Activity.build>
    bvm: ReturnType<typeof Bvm.build>
}

declare module 'vue' {
    interface ComponentCustomProperties {
        $svc: Service
    }
}

let instance: Service | undefined

/** the services for code outside of components (setup functions, utils) */
export function useSvc(): Service {
    if (!instance) {
        throw new Error('services not booted')
    }
    return instance
}

export default defineBoot(async ({ app }) => {
    const storage = await Storage.init()

    const config = Config.build(storage)
    const wallet = Wallet.build(storage)
    const activity = Activity.build(storage)

    const getActiveNodes = async () => {
        const [all, activeMap] = await Promise.all([config.node.all(), config.node.activeMap()])
        const grouped = groupBy(all, n => n.genesis.id)
        return grouped.map(g => {
            return g.find(n => activeMap[n.genesis.id] === n.url) || g[0]!
        })
    }

    let activeNodes = await getActiveNodes()
    const bc = Blockchain.build(gid => {
        const node = activeNodes.find(n => n.genesis.id === gid)
        if (!node) {
            throw new Error('no proper node found')
        }
        return node
    })

    // watch and update active nodes
    void (async () => {
        const ob = storage.configs.observe()
        for (; ;) {
            await ob.changed()
            activeNodes = await getActiveNodes()
        }
    })()

    instance = { bc, config, wallet, activity, bvm: Bvm.build() }

    // names for addresses: contacts, and .vet names from mainnet
    configureNames(() => {
        try {
            return bc(genesises.main.id).thor
        } catch {
            return null
        }
    })
    config.getContacts().then(setContacts).catch(err => console.warn(err))
    app.config.globalProperties.$svc = instance
})
