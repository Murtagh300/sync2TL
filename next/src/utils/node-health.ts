import { reactive } from 'vue'
import type { Service } from 'boot/services'
import { genesises } from 'src/consts'

/**
 * How the mainnet node answers: timed every half minute. When it stops answering twice in a
 * row, the wallet moves to another node of the list that does answer (Settings › Network nodes).
 */

export type Health = 'unknown' | 'ok' | 'slow' | 'down'

export const nodeHealth = reactive({
    status: 'unknown' as Health,
    ms: 0,
    url: '',
    /** the node the wallet moved to, to say so once */
    switchedTo: ''
})

/** milliseconds to the best block, or -1 when the node doesn't answer */
export async function ping(url: string, timeoutMs = 8000): Promise<number> {
    const started = performance.now()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
        const resp = await fetch(new URL('blocks/best', url.endsWith('/') ? url : url + '/').href, { signal: ctrl.signal, cache: 'no-store' })
        if (!resp.ok) return -1
        await resp.json()
        return Math.round(performance.now() - started)
    } catch {
        return -1
    } finally {
        clearTimeout(timer)
    }
}

export function classify(ms: number): Health {
    return ms < 0 ? 'down' : ms < 1500 ? 'ok' : 'slow'
}

let failures = 0
let started = false

async function check(svc: Service) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        // offline: that's the connection, not the node
        return
    }
    let url: string
    try {
        url = svc.bc(genesises.main.id).nodeUrl
    } catch {
        return
    }
    const ms = await ping(url)
    nodeHealth.url = url
    nodeHealth.ms = ms
    nodeHealth.status = classify(ms)
    failures = ms < 0 ? failures + 1 : 0
    if (failures < 2) return

    // move to the first other node that answers
    const nodes = (await svc.config.node.all()).filter(n => n.genesis.id === genesises.main.id && n.url !== url)
    for (const n of nodes) {
        const t = await ping(n.url)
        if (t >= 0) {
            const map = await svc.config.node.activeMap()
            await svc.config.node.saveActiveMap({ ...map, [genesises.main.id]: n.url })
            failures = 0
            nodeHealth.url = n.url
            nodeHealth.ms = t
            nodeHealth.status = classify(t)
            nodeHealth.switchedTo = n.url
            return
        }
    }
}

export function startNodeHealth(svc: Service) {
    if (started) return
    started = true
    void check(svc)
    setInterval(() => void check(svc), 30 * 1000)
}
