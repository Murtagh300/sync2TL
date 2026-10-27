import { reactive, markRaw } from 'vue'
import { genesises } from 'src/consts'

/**
 * WalletConnect v2 for VeChain, the wallet side: dApps connect with a QR code or a wc: link
 * and send their requests over WalletConnect's relay. VeChain's namespace is `vechain`, a
 * network is `vechain:<last 32 hex of the genesis id>`, and the methods are those of
 * VeChain's dapp-kit: thor_sendTransaction and thor_signCertificate ({ message, options }).
 * Every request still goes through BlackVault's own sign dialogs.
 *
 * The SDK is loaded only when WalletConnect is used.
 */

export const METHODS = ['thor_sendTransaction', 'thor_signCertificate', 'thor_signTypedData']
const PROJECT_KEY = 'bv-wc-project'
const USED_KEY = 'bv-wc-used'

export type WcSession = {
    topic: string
    name: string
    url: string
    icon: string
    gid: string
    address: string
    expiry: number
}

export type WcProposal = {
    id: number
    name: string
    url: string
    icon: string
    description: string
    /** WalletConnect's check of the dApp's domain */
    validation: 'VALID' | 'INVALID' | 'UNKNOWN'
    isScam: boolean
    /** the networks it asks for that BlackVault knows */
    gids: string[]
}

export type Handlers = {
    /** ask the user; the network and address to connect, or null to reject */
    approve(p: WcProposal): Promise<{ gid: string, address: string } | null>
    /** sign a transaction or certificate through the wallet's dialogs */
    sendTransaction(gid: string, req: M.TxRequest): Promise<M.TxResponse>
    signCertificate(gid: string, req: M.CertRequest): Promise<M.CertResponse>
    /** a request with a warning, e.g. from a domain WalletConnect could not verify */
    notify(text: string): void
}

export const wc = reactive({
    ready: false,
    connecting: false,
    error: '',
    sessions: [] as WcSession[]
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let kit: any = null
let handlers: Handlers | null = null

export const chainOf = (gid: string) => `vechain:${gid.slice(-32)}`

/** the genesis id of a WalletConnect chain id, when BlackVault knows that network */
export function gidOf(chain: string): string | null {
    const [ns, ref] = chain.split(':')
    if (ns !== 'vechain' || !ref) return null
    const g = [genesises.main.id, genesises.test.id].find(id => id.slice(-32).toLowerCase() === ref.toLowerCase())
    return g || null
}

export function projectId(): string {
    try {
        return import.meta.env.WALLETCONNECT_PROJECT_ID || localStorage.getItem(PROJECT_KEY) || ''
    } catch {
        return import.meta.env.WALLETCONNECT_PROJECT_ID || ''
    }
}

export function setProjectId(id: string) {
    try {
        localStorage.setItem(PROJECT_KEY, id.trim())
    } catch { }
}

/** whether to start WalletConnect with the app: it was used before and is configured */
export function shouldAutostart() {
    try {
        return !!projectId() && localStorage.getItem(USED_KEY) === '1'
    } catch {
        return false
    }
}

function refreshSessions() {
    if (!kit) return
    const all = Object.values(kit.getActiveSessions() as Record<string, {
        topic: string, expiry: number, peer: { metadata: { name: string, url: string, icons: string[] } },
        namespaces: Record<string, { accounts: string[] }>
    }>)
    wc.sessions = all.map(s => {
        const account = s.namespaces.vechain?.accounts?.[0] || ''
        const [ns, ref, address] = account.split(':')
        return {
            topic: s.topic,
            name: s.peer.metadata.name || s.peer.metadata.url,
            url: s.peer.metadata.url,
            icon: s.peer.metadata.icons?.[0] || '',
            gid: gidOf(`${ns}:${ref}`) || '',
            address: address || '',
            expiry: s.expiry * 1000
        }
    })
}

// one start at a time: the host and the WalletConnect page may both ask at once, and two clients
// would split the pairings between them (a dApp's proposal then reaches neither listener)
let starting: Promise<boolean> | null = null

/** start the client and listen for proposals and requests */
export async function initWalletConnect(h: Handlers): Promise<boolean> {
    handlers = h
    if (kit) return true
    if (!starting) {
        starting = startKit().finally(() => { starting = null })
    }
    return starting
}

async function startKit(): Promise<boolean> {
    const id = projectId()
    if (!id) {
        wc.error = 'no-project'
        return false
    }
    try {
        const [{ Core }, { WalletKit }, utils] = await Promise.all([
            import('@walletconnect/core'),
            import('@reown/walletkit'),
            import('@walletconnect/utils')
        ])
        const core = new Core({ projectId: id })
        kit = markRaw(await WalletKit.init({
            core,
            // where this wallet really runs: WalletConnect checks it against the page and the project's domains
            metadata: {
                name: 'BlackVault',
                description: 'The VeChain wallet by BlackVeMarket',
                url: window.location.origin,
                icons: [`${window.location.origin}/icons/icon-192x192.png`]
            }
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kit.on('session_proposal', (ev: any) => void onProposal(ev, utils))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kit.on('session_request', (ev: any) => void onRequest(ev, utils))
        kit.on('session_delete', () => refreshSessions())
        refreshSessions()
        wc.ready = true
        wc.error = ''
        return true
    } catch (err) {
        console.warn('walletconnect:', err)
        wc.error = 'init'
        return false
    }
}

/** connect to a dApp from its wc: link */
export async function pair(uri: string) {
    if (!/^wc:[0-9a-f]+@2\?/i.test(uri.trim())) {
        throw new Error('not a WalletConnect v2 link')
    }
    if (!kit) throw new Error('not started')
    try {
        localStorage.setItem(USED_KEY, '1')
    } catch { }
    wc.connecting = true
    try {
        await kit.pair({ uri: uri.trim() })
    } finally {
        wc.connecting = false
    }
}

export async function disconnect(topic: string) {
    if (!kit) return
    const { getSdkError } = await import('@walletconnect/utils')
    try {
        await kit.disconnectSession({ topic, reason: getSdkError('USER_DISCONNECTED') })
    } finally {
        refreshSessions()
    }
}

/** the networks a proposal asks for (required and optional), as genesis ids BlackVault knows */
export function proposalGids(params: { requiredNamespaces?: Record<string, { chains?: string[] }>, optionalNamespaces?: Record<string, { chains?: string[] }> }): { gids: string[], unsupported: boolean } {
    const required = params.requiredNamespaces || {}
    // anything required outside vechain (an EVM chain, say) can't be served
    const unsupported = Object.keys(required).some(ns => ns !== 'vechain')
    const chains = [...(required.vechain?.chains || []), ...(params.optionalNamespaces?.vechain?.chains || [])]
    const gids = [...new Set(chains.map(gidOf).filter((g): g is string => !!g))]
    return { gids, unsupported }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onProposal(ev: any, utils: any) {
    const { id, params, verifyContext } = ev
    const meta = params.proposer?.metadata || {}
    const { gids, unsupported } = proposalGids(params)
    const reject = (reason: string) => kit.rejectSession({ id, reason: utils.getSdkError(reason) })
    if (unsupported || !gids.length || !handlers) {
        return reject('UNSUPPORTED_CHAINS')
    }
    const proposal: WcProposal = {
        id,
        name: meta.name || meta.url || '',
        url: meta.url || '',
        icon: meta.icons?.[0] || '',
        description: meta.description || '',
        validation: verifyContext?.verified?.validation || 'UNKNOWN',
        isScam: !!verifyContext?.verified?.isScam,
        gids
    }
    const choice = await handlers.approve(proposal).catch(() => null)
    if (!choice) {
        return reject('USER_REJECTED')
    }
    try {
        const chain = chainOf(choice.gid)
        const namespaces = utils.buildApprovedNamespaces({
            proposal: params,
            supportedNamespaces: {
                vechain: { chains: [chain], methods: METHODS, events: [], accounts: [`${chain}:${choice.address}`] }
            }
        })
        await kit.approveSession({ id, namespaces })
    } catch (err) {
        console.warn('walletconnect approve:', err)
        await reject('UNSUPPORTED_NAMESPACE_KEY').catch(() => { })
    } finally {
        refreshSessions()
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onRequest(ev: any, utils: any) {
    const { id, topic, params, verifyContext } = ev
    const respond = (response: unknown) => kit.respondSessionRequest({ topic, response })
    const fail = (code: string) => respond({ id, jsonrpc: '2.0', error: utils.getSdkError(code) })
    const session = wc.sessions.find(s => s.topic === topic) || (refreshSessions(), wc.sessions.find(s => s.topic === topic))
    const gid = gidOf(params.chainId || '')
    if (!session || !gid || gid !== session.gid || !handlers) {
        return fail('UNSUPPORTED_CHAINS')
    }
    if (verifyContext?.verified?.isScam || verifyContext?.verified?.validation === 'INVALID') {
        handlers.notify(session.url)
    }
    const method: string = params.request.method
    const [arg] = (params.request.params || []) as [{ message: unknown, options?: Record<string, unknown> }]
    // the dApp signs with the address it was given, nothing else
    const options = { ...(arg?.options || {}), signer: session.address }
    try {
        if (method === 'thor_sendTransaction') {
            const result = await handlers.sendTransaction(gid, { message: arg.message as Connex.Vendor.TxMessage, options, origin: session.url })
            return respond({ id, jsonrpc: '2.0', result })
        }
        if (method === 'thor_signCertificate') {
            let domain = ''
            try {
                domain = new URL(session.url).host
            } catch { }
            const result = await handlers.signCertificate(gid, { message: arg.message as Connex.Vendor.CertMessage, options, domain, origin: session.url })
            return respond({ id, jsonrpc: '2.0', result })
        }
        return fail('UNSUPPORTED_METHODS')
    } catch {
        return fail('USER_REJECTED')
    }
}
