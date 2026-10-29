import type { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Checkout for web shops: a shop (made in the wallet, for one of its addresses) asks for an order
 * in euros or dollars; the server fixes the amount in VET or B3TR at today's price, with its own
 * last digits, and gives a checkout link the customer opens in BlackVault. The server sees the
 * payment arrive on chain (as the push watcher does) and the shop asks for the order's status.
 *
 * The server never calls a shop: the shop polls. Nobody can make it post anywhere.
 */

export const ORDER_TTL = 30 * 60 * 1000
const ADDRESS = /^0x[0-9a-f]{40}$/
const TOKENS: Record<string, { address: string, decimals: number, betterswap: string }> = {
    VET: { address: '', decimals: 18, betterswap: '' },
    B3TR: { address: '0x5ef79995fe8a89e0812330e4378eb2660cede699', decimals: 18, betterswap: '0x5ef79995fe8a89e0812330e4378eb2660cede699' }
}

const hash = (s: string) => createHash('sha256').update(s).digest()
const id = (n: number) => randomBytes(n).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, n)

export type Order = {
    token: string
    shop: string
    shopName: string
    ref: string
    address: string
    amount: string
    symbol: string
    fiat: number
    currency: string
    status: 'pending' | 'paid' | 'expired'
    txId: string | null
    returnUrl: string
    createdAt: number
    expiresAt: number
}

/** a token amount for a fiat price, rounded up to 2 decimals, plus a tag of 0.0001 to 0.0099 */
export function orderAmount(fiat: number, usdPerToken: number, usdPerUnit: number, tag: number): string {
    const tokens = Math.ceil(fiat * usdPerUnit / usdPerToken * 100) / 100
    const cents = Math.round(tokens * 100)
    return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}${String(Math.min(99, Math.max(1, tag))).padStart(2, '0')}`
}

/** "12.3456" in wei, for 18 decimals */
export function toWei(amount: string, decimals = 18): bigint {
    const [w, f = ''] = amount.split('.')
    return BigInt(w!) * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0')
}

export function createShops(db: DatabaseSync, opts: {
    now?: () => number
    /** USD per token, by BetterSwap address ('' VET) */
    price: (token: string) => Promise<number>
    /** USD per euro */
    eurUsd: () => Promise<number>
}) {
    const now = opts.now || Date.now
    const insertShop = db.prepare('INSERT INTO shops (id, name, address, key_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    const getShop = db.prepare('SELECT id, name, address, key_hash FROM shops WHERE id = ?')
    const insertOrder = db.prepare(`INSERT INTO shop_orders (token, shop, ref, address, amount, symbol, fiat, currency, status, tx_id, return_url, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?)`)
    const byToken = db.prepare(`SELECT o.*, s.name AS shop_name FROM shop_orders o JOIN shops s ON s.id = o.shop WHERE o.token = ?`)
    const byRef = db.prepare(`SELECT o.*, s.name AS shop_name FROM shop_orders o JOIN shops s ON s.id = o.shop WHERE o.shop = ? AND o.ref = ? ORDER BY o.created_at DESC LIMIT 1`)
    const openAmounts = db.prepare(`SELECT amount FROM shop_orders WHERE address = ? AND symbol = ? AND status = 'pending' AND expires_at > ?`)
    const pending = db.prepare(`SELECT token, address, amount, symbol, created_at FROM shop_orders WHERE status = 'pending' AND expires_at > ?`)
    const markPaid = db.prepare(`UPDATE shop_orders SET status = 'paid', tx_id = ? WHERE token = ? AND status = 'pending'`)
    const expire = db.prepare(`UPDATE shop_orders SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?`)

    type Row = { token: string, shop: string, shop_name: string, ref: string, address: string, amount: string, symbol: string, fiat: number, currency: string, status: Order['status'], tx_id: string | null, return_url: string, created_at: number, expires_at: number }
    const order = (r: Row): Order => ({
        token: r.token, shop: r.shop, shopName: r.shop_name, ref: r.ref, address: r.address, amount: r.amount, symbol: r.symbol, fiat: r.fiat, currency: r.currency,
        // an order past its time shows as expired before the sweep gets to it
        status: r.status === 'pending' && r.expires_at <= now() ? 'expired' : r.status,
        txId: r.tx_id, returnUrl: r.return_url, createdAt: r.created_at, expiresAt: r.expires_at
    })

    function authed(shopId: string, key: unknown) {
        const s = /^[a-zA-Z0-9]{10}$/.test(shopId) ? getShop.get(shopId) as { id: string, name: string, address: string, key_hash: Buffer } | undefined : undefined
        if (!s || typeof key !== 'string' || !timingSafeEqual(hash(key), Buffer.from(s.key_hash))) throw new Error('not this shop')
        return s
    }

    return {
        /** a shop for an address: its id, and the key the shop's server uses (shown once) */
        create(raw: unknown): { id: string, key: string } {
            const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
            const address = String(r.address || '').toLowerCase()
            const name = String(r.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60)
            if (!ADDRESS.test(address)) throw new Error('bad address')
            if (!name) throw new Error('name missing')
            const shopId = id(10).padEnd(10, 'x')
            const key = `bvk_${id(32)}`
            insertShop.run(shopId, name, address, hash(key), now())
            return { id: shopId, key }
        },
        /** an order, from the shop's server */
        async createOrder(shopId: string, key: unknown, raw: unknown): Promise<Order> {
            const s = authed(shopId, key)
            const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
            const ref = String(r.ref || '').slice(0, 64)
            const fiat = Number(r.amount)
            const currency = String(r.currency || 'EUR').toUpperCase()
            const symbol = String(r.symbol || 'VET').toUpperCase()
            const returnUrl = String(r.returnUrl || '')
            if (!/^[\w.-]{1,64}$/.test(ref)) throw new Error('bad ref')
            if (!(fiat > 0 && fiat <= 100000)) throw new Error('bad amount')
            if (currency !== 'EUR' && currency !== 'USD') throw new Error('EUR or USD only')
            const t = TOKENS[symbol]
            if (!t) throw new Error('VET or B3TR only')
            if (returnUrl && !/^https:\/\/[^\s<>"]{3,300}$/.test(returnUrl)) throw new Error('returnUrl must be https')
            const [usdPerToken, usdPerUnit] = await Promise.all([opts.price(t.betterswap), currency === 'USD' ? Promise.resolve(1) : opts.eurUsd()])
            if (!(usdPerToken > 0) || !(usdPerUnit > 0)) throw new Error('no price now')
            const taken = new Set((openAmounts.all(s.address, symbol, now()) as { amount: string }[]).map(x => x.amount))
            let amount = ''
            for (let tag = 1 + Math.floor(Math.random() * 99), n = 0; n < 99; n++, tag = tag % 99 + 1) {
                amount = orderAmount(fiat, usdPerToken, usdPerUnit, tag)
                if (!taken.has(amount)) break
            }
            if (taken.has(amount)) throw new Error('too many open orders')
            const token = id(16).padEnd(16, 'x')
            insertOrder.run(token, s.id, ref, s.address, amount, symbol, fiat, currency, returnUrl, now(), now() + ORDER_TTL)
            return order(byToken.get(token) as Row)
        },
        /** an order by its reference, for the shop's server */
        status(shopId: string, key: unknown, ref: string): Order | null {
            authed(shopId, key)
            const r = byRef.get(shopId, ref) as Row | undefined
            return r ? order(r) : null
        },
        /** an order by its checkout token, for the wallet's checkout page */
        checkout(token: string): Order | null {
            const r = /^[a-zA-Z0-9]{16}$/.test(token) ? byToken.get(token) as Row | undefined : undefined
            return r ? order(r) : null
        },
        /** the addresses with open orders, and since when (for the watcher) */
        open(): { address: string, since: number }[] {
            expire.run(now())
            const by = new Map<string, number>()
            for (const r of pending.all(now()) as { address: string, created_at: number }[]) by.set(r.address, Math.min(by.get(r.address) ?? Infinity, r.created_at))
            return [...by].map(([address, since]) => ({ address, since }))
        },
        /** transfers that arrived: settle the open order with that exact amount and token */
        settle(arrivals: { txId: string, to: string, kind: string, contract?: string, amount?: bigint }[]): number {
            const open = pending.all(now()) as { token: string, address: string, amount: string, symbol: string }[]
            let n = 0
            for (const a of arrivals) {
                const hit = open.find(o => o.address === a.to && a.amount === toWei(o.amount, TOKENS[o.symbol]!.decimals) &&
                    (o.symbol === 'VET' ? a.kind === 'vet' : a.kind === 'token' && a.contract === TOKENS[o.symbol]!.address))
                if (hit && Number(markPaid.run(a.txId, hit.token).changes) > 0) {
                    open.splice(open.indexOf(hit), 1)
                    n++
                }
            }
            return n
        }
    }
}

/** USD per euro from the ECB's daily reference rates, kept a few hours */
export function ecbRate() {
    let cached: { at: number, rate: number } | null = null
    return async () => {
        if (cached && Date.now() - cached.at < 6 * 3600 * 1000) return cached.rate
        const r = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { signal: AbortSignal.timeout(15000) })
        const m = /currency='USD' rate='([0-9.]+)'/.exec(await r.text())
        const rate = m ? Number(m[1]) : 0
        if (rate > 0) cached = { at: Date.now(), rate }
        return rate || cached?.rate || 0
    }
}

type Arrivals = (node: string, addresses: string[], from: number, to: number) => Promise<{ txId: string, to: string, kind: string, contract?: string, amount?: bigint }[]>

/** reads new blocks for payments to shops with open orders, every 10 seconds */
export function createShopWatch(db: DatabaseSync, shops: ReturnType<typeof createShops>, opts: { nodes: string[], arrivals: Arrivals }) {
    const getState = db.prepare('SELECT value FROM state WHERE key = ?')
    const setState = db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    let n = 0
    let running = false
    async function tick() {
        if (running) return
        running = true
        try {
            const node = opts.nodes[n++ % opts.nodes.length]!.replace(/\/$/, '')
            const r = await fetch(`${node}/blocks/best`, { signal: AbortSignal.timeout(10000) })
            if (!r.ok) return
            const head = ((await r.json()) as { number: number }).number
            const last = getState.get('shop:lastBlock') as { value: string } | undefined
            const open = shops.open()
            if (!last || !open.length) {
                setState.run('shop:lastBlock', String(head))
                return
            }
            const from = Number(last.value) + 1
            const to = Math.min(head, from + 359)
            if (from > to) return
            shops.settle(await opts.arrivals(node, open.map(o => o.address), from, to))
            setState.run('shop:lastBlock', String(to))
        } catch (err) {
            console.warn('[shop] tick:', (err as Error).message)
        } finally {
            running = false
        }
    }
    return {
        tick,
        start() {
            setInterval(() => void tick(), 10000).unref()
            void tick()
        }
    }
}
