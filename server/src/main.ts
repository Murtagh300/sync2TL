import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import webpush from 'web-push'
import { loadConfig } from './config.ts'
import { clientIp, cors, createRouter, HttpError, json, readJson, readText, securityHeaders } from './http.ts'
import { createRelay, KEY, MAX_BODY } from './relay.ts'
import { RateLimiter } from './rate-limit.ts'
import { createProxy, proxyError } from './proxy.ts'
import { createHealth, statusPage } from './health.ts'
import { createFlags } from './flags.ts'
import { cleanReport } from './scrub.ts'
import { openDb } from './db.ts'
import { createStore, MAX_WATCHED, validateSubscribe, type Subscription } from './push/store.ts'
import { arrivals, createWatcher, tokenRegistry } from './push/watcher.ts'
import { createReminders, validateReminders } from './push/reminders.ts'
import { createRoundWatch } from './push/rounds.ts'
import { createRewardWatch } from './push/voter-rewards.ts'
import { createValidatorWatch } from './push/validators.ts'
import { createTokenWatch } from './push/new-tokens.ts'
import { betterswapPrices, createPriceAlerts, validatePriceAlerts } from './push/price-alerts.ts'
import { createPhishing, HOST } from './phishing.ts'
import { createX2Index } from './x2earn.ts'
import { createChat } from './chat.ts'
import { createTills } from './till.ts'
import { createShops, createShopWatch, ecbRate, ecbRates } from './shop.ts'

/**
 * BlackVault's server. Everything here is public data or data the wallet chose to send;
 * no key, recovery word or signature ever reaches it.
 *
 *   GET  /api/betterswap/*   gateway (listed paths only, cached)
 *   GET  /api/bvm/*          gateway (listed paths only, cached)
 *   GET  /health, /status    what the wallet depends on
 *   GET  /config             remote config (feature switches, a notice)
 *   GET  /phishing?host=     whether a site is a known phishing site
 *   GET  /fx                 the ECB's daily exchange rates (units per euro)
 *   GET  /x2earn/leaderboard?days=7|30&address=   X2Earn's top earners, and where an address stands
 *   POST /chat/key           publish a chat key (a certificate signed by the address)
 *   GET  /chat/keys/:address the chat keys of an address
 *   POST /chat/send          an encrypted message, signed with the sender's chat key
 *   POST /chat/inbox         an address's messages since an id, signed with its chat key
 *   POST /till               a till for an address (an NFC sticker's id, and the till's secret)
 *   POST /till/:id          the till's open sale { secret, amount, symbol } (empty amount: none)
 *   GET  /till/:id           the address and open sale a tap shows
 *   POST /shop               a web shop for an address { address, name }: its id and API key
 *   POST /shop/:id/orders    an order { ref, amount, currency, symbol, returnUrl } (Authorization: Bearer key)
 *   GET  /shop/:id/orders/:ref   an order's status (Authorization: Bearer key)
 *   GET  /checkout/:token    an order as the wallet's checkout page shows it
 *   GET  /push/key           the VAPID public key
 *   POST /push/subscribe     { subscription, addresses, lang, outgoing?, rounds?, rewards?, tokens?, validators? }
 *   POST /push/price-alerts  { endpoint, alerts }: token price alerts pushed once per crossing
 *   POST /push/unsubscribe   { endpoint }
 *   POST /errors             an opt-in, scrubbed error report
 *   GET  /errors             the latest reports (Authorization: Bearer ADMIN_TOKEN)
 *   *    /relay/*            sign requests from dApps to the wallet and back (see relay.ts)
 */

const config = loadConfig()
const db = openDb(config.dbPath)
const store = createStore(db)
const reminders = createReminders(db, store)
const priceAlerts = createPriceAlerts(db, store, betterswapPrices(config.betterswapUrl))
const flags = createFlags(config.flagsFile)
const health = createHealth({ nodes: config.mainnetNodes, bvmUrl: config.bvmUrl, betterswapUrl: config.betterswapUrl })
const proxy = createProxy({ betterswap: config.betterswapUrl, bvm: config.bvmUrl })
const gatewayLimit = new RateLimiter(config.rateLimit.gateway)
const writeLimit = new RateLimiter(config.rateLimit.writes)
const relay = createRelay()
const phishing = createPhishing()
phishing.start()
const x2 = createX2Index({ db, nodes: config.mainnetNodes })
x2.start()
// a sign request is a handful of calls; a waiting wallet asks again every 20 seconds
const relayLimit = new RateLimiter(120)

// push: on when VAPID keys are set (declared first: chat pushes new messages)
let send: ((sub: Subscription, payload: string) => Promise<void>) | null = null
if (config.vapid) {
    webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey)
    send = async (sub, payload) => {
        try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 3600, urgency: 'normal' })
        } catch (err) {
            // gone: the browser dropped this subscription
            const status = (err as { statusCode?: number }).statusCode
            if (status === 404 || status === 410) store.unsubscribe(sub.endpoint)
            else throw err
        }
    }
    createWatcher({ nodes: config.mainnetNodes, store, send, tokens: tokenRegistry() })
    // reminders due: checked every minute
    const sender = send
    setInterval(() => { reminders.tick(sender).catch(err => console.warn('[push] reminders:', err)) }, 60 * 1000).unref()
    // a new VeBetterDAO round, for the devices that asked
    createRoundWatch(db, { nodes: config.mainnetNodes, send }).start()
    // a voting reward to claim, a validator offline or leaving, a new token in the registry
    createRewardWatch(db, { nodes: config.mainnetNodes, send }).start()
    createValidatorWatch(db, { nodes: config.mainnetNodes, send }).start()
    createTokenWatch(db, { send }).start()
    // price alerts: BetterSwap's prices every two minutes
    setInterval(() => { priceAlerts.tick(sender).catch(err => console.warn('[push] price alerts:', (err as Error).message)) }, 2 * 60 * 1000).unref()
    console.log('[push] on')
} else {
    console.log('[push] off: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (npm run vapid makes a pair)')
}

// a push for a new chat message, in the recipient's language; the text stays encrypted
const CHAT_PUSH: Record<string, string> = {
    en: 'New message', nl: 'Nieuw bericht', de: 'Neue Nachricht', fr: 'Nouveau message', zh: '新消息',
    es: 'Mensaje nuevo', it: 'Nuovo messaggio', ja: '新しいメッセージ', ko: '새 메시지',
    pt: 'Nova mensagem', tr: 'Yeni mesaj', vi: 'Tin nhắn mới', ru: 'Новое сообщение', pl: 'Nowa wiadomość', id: 'Pesan baru'
}
const tills = createTills(db)
const usdPrices = betterswapPrices(config.betterswapUrl)
const fxRates = ecbRates()
const shops = createShops(db, { price: async token => (await usdPrices([token])).get(token) || 0, eurUsd: ecbRate(fxRates) })
createShopWatch(db, shops, { nodes: config.mainnetNodes, arrivals }).start()
const chat = createChat(db, {
    onMessage: m => {
        const sender = send
        if (!sender) return
        for (const sub of store.forAddress(m.to)) {
            const payload = JSON.stringify({ title: CHAT_PUSH[sub.lang] || CHAT_PUSH.en, body: 'BlackVault', url: `#/chat?with=${m.from}`, tag: `chat:${m.from}` })
            sender(sub, payload).catch(err => console.warn('[push] chat:', (err as Error).message))
        }
    }
})
setInterval(() => chat.prune(), 3600 * 1000).unref()

const insertReport = db.prepare('INSERT INTO reports (at, message, stack, route, version, ua) VALUES (?, ?, ?, ?, ?, ?)')
const trimReports = db.prepare('DELETE FROM reports WHERE id <= (SELECT id FROM reports ORDER BY id DESC LIMIT 1 OFFSET 10000)')
const latestReports = db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT ?')

/** compares in constant time (hashes first, so the length doesn't show either) */
function sameSecret(given: string, expected: string): boolean {
    const h = (v: string) => createHash('sha256').update(v).digest()
    return timingSafeEqual(h(given), h(expected))
}

const router = createRouter()

router.get('/api/betterswap/*', ctx => proxy(ctx, 'betterswap'))
router.get('/api/bvm/*', ctx => proxy(ctx, 'bvm'))

router.get('/health', async ctx => {
    const h = await health()
    json(ctx.res, h.ok ? 200 : 503, h, { 'Cache-Control': 'no-store' })
})
router.get('/status', async ctx => {
    const h = await health()
    ctx.res.statusCode = h.ok ? 200 : 503
    ctx.res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // the page has an inline style: allow just that
    ctx.res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
    ctx.res.end(statusPage(h))
})
router.get('/config', ctx => json(ctx.res, 200, flags(), { 'Cache-Control': 'public, max-age=60' }))

router.get('/fx', async ctx => {
    try {
        json(ctx.res, 200, { base: 'EUR', rates: await fxRates() }, { 'Cache-Control': 'public, max-age=3600' })
    } catch {
        throw new HttpError(503, 'exchange rates unavailable')
    }
})

router.get('/phishing', ctx => {
    if (!gatewayLimit.take(`ph:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    const host = (ctx.url.searchParams.get('host') || '').toLowerCase()
    if (!HOST.test(host)) throw new HttpError(400, 'not a host name')
    // not stored or logged: only the answer goes back
    json(ctx.res, 200, { listed: phishing.check(host) }, { 'Cache-Control': 'public, max-age=3600' })
})

router.get('/x2earn/leaderboard', ctx => {
    if (!gatewayLimit.take(`x2:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    const days = ctx.url.searchParams.get('days') === '30' ? 30 : 7
    const address = ctx.url.searchParams.get('address') || ''
    if (address && !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new HttpError(400, 'not an address')
    json(ctx.res, 200, x2.board(days, address), { 'Cache-Control': address ? 'private, max-age=300' : 'public, max-age=300' })
})

router.post('/till', async ctx => {
    if (!writeLimit.take(`till:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    try {
        json(ctx.res, 200, tills.create(await readJson(ctx.req, 1024)))
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(400, (err as Error).message)
    }
})
router.post('/till/:id', async ctx => {
    // a till puts up one sale after another: the looser limit
    if (!relayLimit.take(`till:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    try {
        tills.set(String(ctx.params.id || ''), await readJson(ctx.req, 1024))
        json(ctx.res, 200, { ok: true })
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(403, (err as Error).message)
    }
})
router.get('/till/:id', ctx => {
    if (!gatewayLimit.take(`till:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    const t = tills.read(String(ctx.params.id || ''))
    if (!t) throw new HttpError(404, 'no such till')
    json(ctx.res, 200, t, { 'Cache-Control': 'no-store' })
})

router.post('/shop', async ctx => {
    if (!writeLimit.take(`shop:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    try {
        json(ctx.res, 200, shops.create(await readJson(ctx.req, 1024)))
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(400, (err as Error).message)
    }
})
const shopKey = (ctx: { req: IncomingMessage }) => String(ctx.req.headers.authorization || '').replace(/^Bearer\s+/i, '')
router.post('/shop/:id/orders', async ctx => {
    if (!relayLimit.take(`order:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    try {
        json(ctx.res, 200, await shops.createOrder(String(ctx.params.id || ''), shopKey(ctx), await readJson(ctx.req, 2048)), { 'Cache-Control': 'no-store' })
    } catch (err) {
        const msg = (err as Error).message
        throw err instanceof HttpError ? err : new HttpError(msg === 'not this shop' ? 401 : msg === 'no price now' ? 503 : 400, msg)
    }
})
router.get('/shop/:id/orders/:ref', ctx => {
    if (!relayLimit.take(`order:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    let o
    try {
        o = shops.status(String(ctx.params.id || ''), shopKey(ctx), decodeURIComponent(String(ctx.params.ref || '')))
    } catch (err) {
        throw new HttpError(401, (err as Error).message)
    }
    if (!o) throw new HttpError(404, 'no such order')
    json(ctx.res, 200, o, { 'Cache-Control': 'no-store' })
})
router.get('/checkout/:token', ctx => {
    if (!gatewayLimit.take(`checkout:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    const o = shops.checkout(String(ctx.params.token || ''))
    if (!o) throw new HttpError(404, 'no such order')
    // what the customer sees: not the shop's own reference
    json(ctx.res, 200, { shopName: o.shopName, address: o.address, amount: o.amount, symbol: o.symbol, fiat: o.fiat, currency: o.currency, status: o.status, txId: o.txId, returnUrl: o.returnUrl, expiresAt: o.expiresAt }, { 'Cache-Control': 'no-store' })
})

router.post('/chat/key', async ctx => {
    if (!writeLimit.take(`chat:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    try {
        json(ctx.res, 200, chat.publish(await readJson(ctx.req, 4096)))
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(400, (err as Error).message)
    }
})
router.get('/chat/keys/:address', ctx => {
    if (!gatewayLimit.take(`chat:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    const a = String(ctx.params.address || '').toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(a)) throw new HttpError(400, 'not an address')
    json(ctx.res, 200, { keys: chat.keys(a) }, { 'Cache-Control': 'no-store' })
})
router.post('/chat/send', async ctx => {
    // chat is talk, not bulk: its own, looser limit next to the other writes
    if (!relayLimit.take(`chat:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    try {
        const m = chat.send(await readJson(ctx.req, 16 * 1024))
        json(ctx.res, 200, { id: m.id })
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(400, (err as Error).message)
    }
})
router.post('/chat/inbox', async ctx => {
    if (!relayLimit.take(`inbox:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    try {
        json(ctx.res, 200, { messages: chat.read(await readJson(ctx.req, 4096)) }, { 'Cache-Control': 'no-store' })
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(400, (err as Error).message)
    }
})

router.get('/push/key', ctx => {
    if (!config.vapid) throw new HttpError(503, 'push is not set up')
    json(ctx.res, 200, { publicKey: config.vapid.publicKey }, { 'Cache-Control': 'public, max-age=3600' })
})
router.post('/push/subscribe', async ctx => {
    if (!send) throw new HttpError(503, 'push is not set up')
    if (!writeLimit.take(ctx.ip)) throw new HttpError(429, 'slow down')
    let valid
    try {
        valid = validateSubscribe(await readJson(ctx.req))
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(400, (err as Error).message)
    }
    if (store.count() >= 200000) throw new HttpError(503, 'too many subscriptions')
    // the watcher reads every watched address every 10 seconds: keep that bounded
    if (store.watchedCount() + valid.addresses.length > MAX_WATCHED) throw new HttpError(503, 'push is full for now')
    store.subscribe(valid.sub, valid.addresses)
    json(ctx.res, 200, { ok: true, addresses: valid.addresses.length })
})
router.post('/push/reminders', async ctx => {
    if (!send) throw new HttpError(503, 'push is not set up')
    if (!writeLimit.take(ctx.ip)) throw new HttpError(429, 'slow down')
    let valid
    try {
        valid = validateReminders(await readJson(ctx.req))
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(400, (err as Error).message)
    }
    if (!reminders.replace(valid.endpoint, valid.reminders)) throw new HttpError(404, 'not subscribed')
    json(ctx.res, 200, { ok: true, reminders: valid.reminders.length })
})
router.post('/push/price-alerts', async ctx => {
    if (!send) throw new HttpError(503, 'push is not set up')
    if (!writeLimit.take(ctx.ip)) throw new HttpError(429, 'slow down')
    let valid
    try {
        valid = validatePriceAlerts(await readJson(ctx.req))
    } catch (err) {
        throw err instanceof HttpError ? err : new HttpError(400, (err as Error).message)
    }
    if (!priceAlerts.replace(valid.endpoint, valid.alerts)) throw new HttpError(404, 'not subscribed')
    json(ctx.res, 200, { ok: true, alerts: valid.alerts.length })
})
router.post('/push/unsubscribe', async ctx => {
    if (!writeLimit.take(ctx.ip)) throw new HttpError(429, 'slow down')
    const body = await readJson<{ endpoint?: unknown }>(ctx.req)
    if (typeof body.endpoint !== 'string') throw new HttpError(400, 'endpoint missing')
    store.unsubscribe(body.endpoint)
    json(ctx.res, 200, { ok: true })
})

router.post('/errors', async ctx => {
    if (!writeLimit.take(`err:${ctx.ip}`)) throw new HttpError(429, 'slow down')
    const report = cleanReport(await readJson(ctx.req, 12 * 1024))
    if (!report) throw new HttpError(400, 'not a report')
    insertReport.run(Date.now(), report.message, report.stack, report.route, report.version, report.ua)
    trimReports.run()
    json(ctx.res, 202, { ok: true })
})
router.get('/errors', ctx => {
    if (!config.adminToken || !sameSecret(String(ctx.req.headers.authorization || ''), `Bearer ${config.adminToken}`)) throw new HttpError(401, 'not allowed')
    const n = Math.min(500, Math.max(1, parseInt(ctx.url.searchParams.get('limit') || '100', 10) || 100))
    json(ctx.res, 200, latestReports.all(n), { 'Cache-Control': 'no-store' })
})

/** the relay is for any dApp: open CORS, plain-text bodies (no preflight), its own limits */
async function relayRoute(req: IncomingMessage, res: ServerResponse, url: URL, ip: string) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Expose-Headers', 'X-Data-Origin')
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'content-type')
        res.setHeader('Access-Control-Max-Age', '600')
        res.statusCode = 204
        res.end()
        return
    }
    const key = url.pathname.slice('/relay/'.length)
    if (!KEY.test(key)) throw new HttpError(404, 'not found')
    if (req.method === 'GET') {
        if (!relayLimit.take(`get:${ip}`)) throw new HttpError(429, 'slow down')
        const ac = new AbortController()
        res.on('close', () => ac.abort())
        const e = await relay.get(key, url.searchParams.get('wait') === '1' ? 20000 : 0, ac.signal)
        if (res.destroyed) return
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        if (e) res.setHeader('X-Data-Origin', e.origin)
        res.end(e ? e.body : '')
        return
    }
    if (req.method !== 'POST') throw new HttpError(405, 'not allowed')
    if (!relayLimit.take(`post:${ip}`)) throw new HttpError(429, 'slow down')
    // the origin the wallet shows: browsers set it, a page can't
    const origin = String(req.headers.origin || '')
    if (!/^https?:\/\/[^\s/]+$/.test(origin)) throw new HttpError(400, 'origin missing')
    const body = await readText(req, MAX_BODY)
    if (!body) throw new HttpError(400, 'empty')
    const r = relay.put(key, body, origin)
    if (r === 'exists') throw new HttpError(409, 'already written')
    if (r === 'full') throw new HttpError(503, 'relay is full')
    json(res, 200, { ok: true })
}

const server = createServer(async (req, res) => {
    securityHeaders(res)
    const url = new URL(req.url || '/', 'http://localhost')
    const ip = clientIp(req, config.trustProxy)
    if (url.pathname.startsWith('/relay/')) {
        try {
            await relayRoute(req, res, url, ip)
        } catch (err) {
            if (res.headersSent) return void res.end()
            if (!(err instanceof HttpError)) console.error('[relay]', err)
            json(res, err instanceof HttpError ? err.status : 500, { error: err instanceof HttpError ? err.message : 'server error' })
        }
        return
    }
    if (!cors(req, res, config.allowedOrigins)) return
    const route = router.match(req.method || 'GET', url.pathname)
    if (!route) {
        json(res, router.knows(url.pathname) ? 405 : 404, { error: 'not found' })
        return
    }
    const ctx = { req, res, url, params: route.params, ip }
    try {
        if (url.pathname.startsWith('/api/') && !gatewayLimit.take(ip)) throw new HttpError(429, 'slow down')
        await route.handler(ctx)
    } catch (err) {
        if (res.headersSent) {
            res.end()
            return
        }
        if (url.pathname.startsWith('/api/')) {
            proxyError(ctx, err)
            return
        }
        const status = err instanceof HttpError ? err.status : 500
        // our own refusals are answers, not faults
        if (!(err instanceof HttpError)) console.error(`[${req.method} ${url.pathname}]`, err)
        json(res, status, { error: err instanceof HttpError ? err.message : 'server error' })
    }
})

server.listen(config.port, () => console.log(`[server] listening on ${config.port}; origins: ${config.allowedOrigins.join(', ')}`))

const shutdown = () => {
    console.log('[server] shutting down')
    server.close(() => {
        db.close()
        process.exit(0)
    })
    setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
