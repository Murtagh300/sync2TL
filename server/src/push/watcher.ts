import type { Store, Subscription } from './store.ts'

/**
 * Reads the new blocks for transfers to watched addresses and sends one push per transaction
 * per subscriber: "Received 25 VET". Tokens outside VeChain's token registry are left out,
 * as in the wallet (airdropped spam lives there).
 */

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const pad = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0')
const topicAddress = (t: string) => '0x' + t.slice(-40).toLowerCase()

export type Arrival = { txId: string, to: string, from: string, kind: 'vet' | 'token' | 'nft', contract?: string, amount?: bigint }
export type TokenInfo = { symbol: string, decimals: number }

type Log = { meta: { txID: string }, sender?: string, recipient?: string, amount?: string, address?: string, topics?: string[], data?: string }

async function post<T>(node: string, path: string, body: unknown): Promise<T> {
    const resp = await fetch(`${node.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
    })
    if (!resp.ok) throw new Error(`node ${resp.status}`)
    return resp.json() as Promise<T>
}

async function best(node: string): Promise<number> {
    const resp = await fetch(`${node.replace(/\/$/, '')}/blocks/best`, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) throw new Error(`node ${resp.status}`)
    return ((await resp.json()) as { number: number }).number
}

/** the transfers to these addresses in a block range (VET, tokens and NFTs) */
export async function arrivals(node: string, addresses: string[], from: number, to: number): Promise<Arrival[]> {
    const out: Arrival[] = []
    const range = { unit: 'block', from, to }
    for (let i = 0; i < addresses.length; i += 100) {
        const chunk = addresses.slice(i, i + 100)
        for (let offset = 0; ; offset += 256) {
            const vet = await post<Log[]>(node, '/logs/transfer', { range, options: { offset, limit: 256 }, criteriaSet: chunk.map(a => ({ recipient: a })) })
            for (const l of vet) {
                out.push({ txId: l.meta.txID, to: l.recipient!.toLowerCase(), from: l.sender!.toLowerCase(), kind: 'vet', amount: BigInt(l.amount!) })
            }
            if (vet.length < 256) break
        }
        for (let offset = 0; ; offset += 256) {
            const events = await post<Log[]>(node, '/logs/event', { range, options: { offset, limit: 256 }, criteriaSet: chunk.map(a => ({ topic0: TRANSFER, topic2: pad(a) })) })
            for (const e of events) {
                const topics = e.topics || []
                const nft = topics.length === 4
                out.push({
                    txId: e.meta.txID,
                    to: topicAddress(topics[2]!),
                    from: topicAddress(topics[1]!),
                    kind: nft ? 'nft' : 'token',
                    contract: e.address!.toLowerCase(),
                    ...(nft ? {} : { amount: BigInt(!e.data || e.data === '0x' ? 0 : e.data) })
                })
            }
            if (events.length < 256) break
        }
    }
    return out
}

const TEXT: Record<string, { received: string, nft: string }> = {
    en: { received: 'Received {what}', nft: 'an NFT' },
    nl: { received: '{what} ontvangen', nft: 'een NFT' },
    de: { received: '{what} empfangen', nft: 'ein NFT' },
    fr: { received: '{what} reçu', nft: 'un NFT' },
    zh: { received: '收到 {what}', nft: '一个 NFT' }
}

export function formatAmount(amount: bigint, decimals: number): string {
    const s = amount.toString().padStart(decimals + 1, '0')
    const whole = s.slice(0, s.length - decimals) || '0'
    const frac = s.slice(s.length - decimals).replace(/0+$/, '').slice(0, 4)
    return frac ? `${whole}.${frac}` : whole
}

/**
 * what each subscriber hears: one message per subscriber per transaction, without moves
 * between that subscriber's own addresses and without tokens nobody registered
 */
export function messagesFor(list: Arrival[], subsOf: (address: string) => (Subscription & { addresses: string[] })[], token: (contract: string) => TokenInfo | undefined) {
    const out = new Map<string, { sub: Subscription, txId: string, parts: string[] }>()
    for (const a of list) {
        for (const sub of subsOf(a.to)) {
            if (sub.addresses.includes(a.from)) continue
            let what: string | null = null
            const t = TEXT[sub.lang] || TEXT.en!
            if (a.kind === 'vet') what = `${formatAmount(a.amount!, 18)} VET`
            else if (a.kind === 'nft') what = t.nft
            else {
                const info = token(a.contract!)
                if (info) what = `${formatAmount(a.amount!, info.decimals)} ${info.symbol}`
            }
            if (!what) continue
            const key = `${sub.endpoint}|${a.txId}`
            const m = out.get(key) || { sub, txId: a.txId, parts: [] }
            m.parts.push(what)
            out.set(key, m)
        }
    }
    return [...out.values()].map(m => {
        const t = TEXT[m.sub.lang] || TEXT.en!
        return { sub: m.sub, txId: m.txId, title: t.received.replace('{what}', m.parts.join(' + ')) }
    })
}

type Sender = (sub: Subscription, payload: string) => Promise<void>

export function createWatcher(opts: { nodes: string[], store: Store, send: Sender, tokens: () => Promise<Map<string, TokenInfo>> }) {
    let running = false
    let nodeIndex = 0
    const tick = async () => {
        if (running) return
        running = true
        try {
            const addresses = opts.store.addresses()
            const node = opts.nodes[nodeIndex % opts.nodes.length]!
            let head: number
            try {
                head = await best(node)
            } catch {
                // this node is down: the next one next time
                nodeIndex++
                return
            }
            const last = opts.store.lastBlock()
            if (last === null || !addresses.length) {
                // nothing to catch up on: start from here
                opts.store.setLastBlock(head)
                return
            }
            // at most 360 blocks (an hour) per tick, so a long outage catches up in steps
            const from = last + 1
            const to = Math.min(head, from + 359)
            if (from > to) return
            const list = await arrivals(node, addresses, from, to)
            if (list.length) {
                const tokens = await opts.tokens().catch(() => new Map<string, TokenInfo>())
                for (const m of messagesFor(list, a => opts.store.forAddress(a), c => tokens.get(c))) {
                    const payload = JSON.stringify({ title: m.title, body: 'BlackVault', url: '#/activities', tag: m.txId })
                    await opts.send(m.sub, payload).catch(err => console.warn('[push] send failed:', (err as Error).message))
                }
            }
            opts.store.setLastBlock(to)
        } catch (err) {
            console.warn('[push] tick failed:', (err as Error).message)
        } finally {
            running = false
        }
    }
    const timer = setInterval(() => void tick(), 10000)
    timer.unref()
    void tick()
    return { tick, stop: () => clearInterval(timer) }
}

/** VeChain's token registry (mainnet), refreshed every six hours */
export function tokenRegistry(url = 'https://vechain.github.io/token-registry/main.json') {
    let cached: { at: number, map: Promise<Map<string, TokenInfo>> } | null = null
    return () => {
        if (!cached || Date.now() - cached.at > 6 * 3600 * 1000) {
            const map = fetch(url, { signal: AbortSignal.timeout(15000) })
                .then(r => r.json() as Promise<{ address: string, symbol: string, decimals: number }[]>)
                .then(list => new Map(list.map(t => [t.address.toLowerCase(), { symbol: t.symbol, decimals: t.decimals }])))
            map.catch(() => { cached = null })
            cached = { at: Date.now(), map }
        }
        return cached.map
    }
}
