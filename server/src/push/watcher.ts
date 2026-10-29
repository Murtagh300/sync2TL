import type { Store, Subscription } from './store.ts'

/**
 * Reads the new blocks for transfers to watched addresses and sends one push per transaction
 * per subscriber: "Received 25 VET". Tokens outside VeChain's token registry are left out,
 * as in the wallet (airdropped spam lives there).
 *
 * A subscriber that asked for it also hears what leaves its addresses: "Sent 25 VET", and an
 * approval given to a contract. That is how a key used on another device shows up at once.
 */

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
const APPROVAL_FOR_ALL = '0x17307eab39ab6107e8899845ad3d59bd9653c200f220920489ca2b5937696c31'
const pad = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0')
const topicAddress = (t: string) => '0x' + t.slice(-40).toLowerCase()

export type Arrival = { txId: string, to: string, from: string, kind: 'vet' | 'token' | 'nft', contract?: string, amount?: bigint }
export type TokenInfo = { symbol: string, decimals: number }
/** something leaving a watched address: a transfer out, or an approval it gave */
export type Departure = { txId: string, from: string, to: string, kind: 'vet' | 'token' | 'nft' | 'approval', contract?: string, amount?: bigint }

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

/** transfers out of these addresses and approvals they gave, in a block range */
export async function departures(node: string, addresses: string[], from: number, to: number): Promise<Departure[]> {
    const out: Departure[] = []
    const range = { unit: 'block', from, to }
    for (let i = 0; i < addresses.length; i += 100) {
        const chunk = addresses.slice(i, i + 100)
        for (let offset = 0; ; offset += 256) {
            const vet = await post<Log[]>(node, '/logs/transfer', { range, options: { offset, limit: 256 }, criteriaSet: chunk.map(a => ({ sender: a })) })
            for (const l of vet) {
                out.push({ txId: l.meta.txID, from: l.sender!.toLowerCase(), to: l.recipient!.toLowerCase(), kind: 'vet', amount: BigInt(l.amount!) })
            }
            if (vet.length < 256) break
        }
        const criteriaSet = chunk.flatMap(a => [TRANSFER, APPROVAL, APPROVAL_FOR_ALL].map(topic0 => ({ topic0, topic1: pad(a) })))
        for (let offset = 0; ; offset += 256) {
            const events = await post<Log[]>(node, '/logs/event', { range, options: { offset, limit: 256 }, criteriaSet })
            for (const e of events) {
                const topics = e.topics || []
                const data = !e.data || e.data === '0x' ? 0n : BigInt(e.data)
                const owner = topicAddress(topics[1]!)
                const contract = e.address!.toLowerCase()
                if (topics[0] === TRANSFER) {
                    const nft = topics.length === 4
                    out.push({ txId: e.meta.txID, from: owner, to: topicAddress(topics[2]!), kind: nft ? 'nft' : 'token', contract, ...(nft ? {} : { amount: data }) })
                } else if (topics[0] === APPROVAL_FOR_ALL) {
                    // the operator sits in topic 2, approved in the data; turning one off is no news
                    if (data !== 0n) out.push({ txId: e.meta.txID, from: owner, to: topicAddress(topics[2]!), kind: 'approval', contract })
                } else if (topics.length === 4 || data !== 0n) {
                    // a token allowance (amount 0 takes one back) or one NFT
                    out.push({ txId: e.meta.txID, from: owner, to: topicAddress(topics[2]!), kind: 'approval', contract })
                }
            }
            if (events.length < 256) break
        }
    }
    return out
}

const TEXT: Record<string, { received: string, nft: string, sent: string, approval: string }> = {
    en: { received: 'Received {what}', nft: 'an NFT', sent: 'Sent {what} from your address', approval: 'Your address approved {who} to spend {what}' },
    nl: { received: '{what} ontvangen', nft: 'een NFT', sent: '{what} verstuurd vanaf je adres', approval: 'Je adres gaf {who} toestemming voor {what}' },
    de: { received: '{what} empfangen', nft: 'ein NFT', sent: '{what} von deiner Adresse gesendet', approval: 'Deine Adresse hat {who} für {what} freigegeben' },
    fr: { received: '{what} reçu', nft: 'un NFT', sent: '{what} envoyé depuis votre adresse', approval: 'Votre adresse a autorisé {who} pour {what}' },
    zh: { received: '收到 {what}', nft: '一个 NFT', sent: '已从你的地址发出 {what}', approval: '你的地址已授权 {who} 使用 {what}' },
    es: { received: 'Recibido {what}', nft: 'un NFT', sent: 'Enviado {what} desde tu dirección', approval: 'Tu dirección autorizó a {who} a usar {what}' },
    it: { received: 'Ricevuto {what}', nft: 'un NFT', sent: 'Inviato {what} dal tuo indirizzo', approval: 'Il tuo indirizzo ha autorizzato {who} per {what}' },
    ja: { received: '{what} を受け取りました', nft: 'NFT', sent: 'あなたのアドレスから {what} を送信しました', approval: 'あなたのアドレスが {who} に {what} の使用を承認しました' },
    ko: { received: '{what} 받음', nft: 'NFT', sent: '내 주소에서 {what} 보냄', approval: '내 주소가 {who}에게 {what} 사용을 승인함' },
    pt: { received: 'Recebido {what}', nft: 'um NFT', sent: 'Enviado {what} do seu endereço', approval: 'Seu endereço autorizou {who} a usar {what}' },
    tr: { received: '{what} alındı', nft: 'bir NFT', sent: 'Adresinizden {what} gönderildi', approval: 'Adresiniz {who} için {what} harcama onayı verdi' },
    vi: { received: 'Đã nhận {what}', nft: 'một NFT', sent: 'Đã gửi {what} từ địa chỉ của bạn', approval: 'Địa chỉ của bạn đã cho phép {who} dùng {what}' },
    ru: { received: 'Получено {what}', nft: 'NFT', sent: 'С вашего адреса отправлено {what}', approval: 'Ваш адрес разрешил {who} тратить {what}' },
    pl: { received: 'Otrzymano {what}', nft: 'NFT', sent: 'Wysłano {what} z Twojego adresu', approval: 'Twój adres zezwolił {who} na wydawanie {what}' },
    id: { received: 'Menerima {what}', nft: 'sebuah NFT', sent: 'Mengirim {what} dari alamat Anda', approval: 'Alamat Anda mengizinkan {who} memakai {what}' }
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/**
 * what each subscriber that asked for outgoing news hears: one message per transaction, without
 * moves between its own addresses; an approval counts whatever the contract (that is the point)
 */
export function outgoingFor(list: Departure[], subsOf: (address: string) => (Subscription & { addresses: string[] })[], token: (contract: string) => TokenInfo | undefined) {
    const out = new Map<string, { sub: Subscription, txId: string, sent: string[], approvals: string[] }>()
    for (const d of list) {
        for (const sub of subsOf(d.from)) {
            if (!sub.outgoing) continue
            const t = TEXT[sub.lang] || TEXT.en!
            const key = `${sub.endpoint}|${d.txId}`
            const m = out.get(key) || { sub, txId: d.txId, sent: [], approvals: [] }
            if (d.kind === 'approval') {
                const info = token(d.contract!)
                m.approvals.push(t.approval.replace('{who}', short(d.to)).replace('{what}', info ? info.symbol : short(d.contract!)))
            } else {
                if (sub.addresses.includes(d.to)) continue
                if (d.kind === 'vet') {
                    if (d.amount === 0n) continue
                    m.sent.push(`${formatAmount(d.amount!, 18)} VET`)
                } else if (d.kind === 'nft') m.sent.push(t.nft)
                else {
                    const info = token(d.contract!)
                    m.sent.push(info ? `${formatAmount(d.amount!, info.decimals)} ${info.symbol}` : short(d.contract!))
                }
            }
            out.set(key, m)
        }
    }
    return [...out.values()].filter(m => m.sent.length || m.approvals.length).map(m => {
        const t = TEXT[m.sub.lang] || TEXT.en!
        const title = m.approvals.length ? m.approvals[0]! : t.sent.replace('{what}', m.sent.join(' + '))
        return { sub: m.sub, txId: m.txId, title, url: m.approvals.length ? '#/approvals' : '#/activities' }
    })
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
            const outgoing = opts.store.outgoingAddresses()
            if (outgoing.length) {
                const gone = await departures(node, outgoing, from, to)
                if (gone.length) {
                    const tokens = await opts.tokens().catch(() => new Map<string, TokenInfo>())
                    for (const m of outgoingFor(gone, a => opts.store.forAddress(a), c => tokens.get(c))) {
                        const payload = JSON.stringify({ title: m.title, body: 'BlackVault', url: m.url, tag: `${m.txId}:out` })
                        await opts.send(m.sub, payload).catch(err => console.warn('[push] send failed:', (err as Error).message))
                    }
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
