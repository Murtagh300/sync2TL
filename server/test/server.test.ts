import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { TtlCache } from '../src/cache.ts'
import { RateLimiter } from '../src/rate-limit.ts'
import { createProxy, ruleFor } from '../src/proxy.ts'
import { sanitizeFlags, DEFAULT_FLAGS } from '../src/flags.ts'
import { cleanReport, scrub } from '../src/scrub.ts'
import { createRouter } from '../src/http.ts'
import { createRelay, KEY } from '../src/relay.ts'
import { openDb } from '../src/db.ts'
import { createStore, validateSubscribe, type Subscription } from '../src/push/store.ts'
import { createTills, SALE_TTL } from '../src/till.ts'
import { createShops, orderAmount, ORDER_TTL, toWei } from '../src/shop.ts'
import { createRoundWatch, roundText } from '../src/push/rounds.ts'
import { createRewardWatch, rewardText } from '../src/push/voter-rewards.ts'
import { createValidatorWatch, validatorText, type ValidatorState } from '../src/push/validators.ts'
import { createTokenWatch, tokenText } from '../src/push/new-tokens.ts'
import { createPriceAlerts, validatePriceAlerts } from '../src/push/price-alerts.ts'
import { formatAmount, messagesFor, outgoingFor, type Arrival, type Departure } from '../src/push/watcher.ts'
import { createReminders, nextAfter, validateReminders } from '../src/push/reminders.ts'
import { createPhishing, domainsOf, HOST, isListed, parseLists } from '../src/phishing.ts'
import { createX2Index, parseReward, REWARD_DISTRIBUTED, REWARDS_POOL } from '../src/x2earn.ts'
import { chatHash, createChat } from '../src/chat.ts'
import { address as addr, blake2b256, Certificate, secp256k1 } from 'thor-devkit'

const A = '0x' + 'a'.repeat(40)
const B = '0x' + 'b'.repeat(40)
const TOKEN = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
const sub = { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'BOrAb0dEAbCdEfGh', auth: 'aBcDeFgHiJk' } }, addresses: [A], lang: 'nl' }

test('the cache serves fresh, then stale while refreshing, and merges requests in flight', async () => {
    let t = 0
    let calls = 0
    const cache = new TtlCache<number>(10, () => t)
    const load = async () => ++calls
    const [a, b] = await Promise.all([cache.get('k', 100, 100, load), cache.get('k', 100, 100, load)])
    assert.equal(calls, 1)
    assert.deepEqual([a.value, b.value], [1, 1])
    t = 50
    assert.equal((await cache.get('k', 100, 100, load)).cache, 'hit')
    t = 150
    const stale = await cache.get('k', 100, 100, load)
    assert.equal(stale.cache, 'stale')
    assert.equal(stale.value, 1)
    t = 1000
    assert.equal((await cache.get('k', 100, 100, load)).cache, 'miss')
})

test('the cache drops the oldest entry when full', () => {
    const cache = new TtlCache<number>(2)
    cache.set('a', 1, 1000)
    cache.set('b', 2, 1000)
    cache.set('c', 3, 1000)
    assert.equal(cache.size, 2)
    assert.equal(cache.peek('a'), undefined)
})

test('rate limits allow a burst and refill over time', () => {
    let t = 0
    const rl = new RateLimiter(3, () => t)
    assert.deepEqual([rl.take('x'), rl.take('x'), rl.take('x'), rl.take('x')], [true, true, true, false])
    assert.equal(rl.take('y'), true)
    t = 20000
    assert.equal(rl.take('x'), true)
    assert.equal(rl.take('x'), false)
})

test('the gateway passes listed read-only paths only', () => {
    assert.ok(ruleFor('betterswap', 'token-prices/stats'))
    assert.ok(ruleFor('bvm', 'collection/vaiyanitems/floor-history'))
    assert.ok(ruleFor('bvm', `profile/${A}`))
    assert.equal(ruleFor('bvm', 'auth/session'), null)
    assert.equal(ruleFor('bvm', 'delegate/sign'), null)
    assert.equal(ruleFor('bvm', 'collection/../auth/session'), null)
    assert.equal(ruleFor('betterswap', 'admin'), null)
    assert.ok(ruleFor('bvm', `wallet/${A}/vet-name`))
})

test('the gateway caches upstream answers and keeps the query', async () => {
    let hits = 0
    const upstream = createServer((req, res) => {
        hits++
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ url: req.url }))
    })
    await new Promise<void>(r => upstream.listen(0, r))
    const base = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`
    const proxy = createProxy({ betterswap: base, bvm: base })
    const call = async (query: string, rest = 'token-prices/history') => {
        let body = ''
        const headers: Record<string, string> = {}
        const res = { statusCode: 0, setHeader: (k: string, v: string) => { headers[k] = v }, end: (b: string) => { body = b } }
        const url = new URL(`http://x/api/betterswap/${rest}${query}`)
        await proxy({ req: {} as never, res: res as never, url, params: { rest }, ip: '1' }, 'betterswap')
        return { status: res.statusCode, body: JSON.parse(body), cache: headers['X-Cache'] }
    }
    const first = await call('?hours=24&addresses=0x1')
    const second = await call('?addresses=0x1&hours=24')
    // a parameter the wallet never sends, or one twice, makes no new cache entry: it is refused
    await assert.rejects(call('?addresses=0x1&hours=24&bust=1'), /query not allowed/)
    await assert.rejects(call('?addresses=0x1&addresses=0x2'), /query not allowed/)
    await assert.rejects(call('?x=1', 'tokens'), /query not allowed/)
    upstream.close()
    assert.equal(first.status, 200)
    assert.equal(first.body.url, '/token-prices/history?addresses=0x1&hours=24')
    assert.equal(second.cache, 'hit')
    assert.equal(hits, 1)
})

test('the cache keeps to its byte budget', () => {
    const cache = new TtlCache<string>(100, Date.now, { maxBytes: 10, sizeOf: v => v.length })
    cache.set('a', '1234', 1000)
    cache.set('b', '5678', 1000)
    cache.set('c', '90ab', 1000)
    assert.equal(cache.peek('a'), undefined)
    assert.ok(cache.totalBytes <= 10)
    cache.set('huge', 'x'.repeat(11), 1000)
    assert.equal(cache.peek('huge'), undefined)
    cache.set('b', '1', 1000)
    assert.equal(cache.totalBytes, 5)
})

test('remote config can only switch features and show a notice', () => {
    const f = sanitizeFlags({ features: { swap: false, evil: true, payout: 'no' }, notice: { level: 'warning', text: { nl: 'Onderhoud', 'bad lang': 'x' } }, minVersion: '2.1.0', extra: 1 })
    assert.equal(f.features.swap, false)
    assert.equal(f.features.payout, true)
    assert.equal('evil' in f.features, false)
    assert.deepEqual(f.notice, { level: 'warning', text: { nl: 'Onderhoud' } })
    assert.equal(f.minVersion, '2.1.0')
    assert.deepEqual(sanitizeFlags('nonsense'), DEFAULT_FLAGS)
})

test('error reports lose addresses, ids, names, amounts and recovery words', () => {
    const text = `failed for ${A} tx 0x${'f'.repeat(64)} alice.vet paid 12.5 VET at https://x.io/api/profile/${A}?k=1 abandon ability able about above absent absorb abstract absurd abuse access accident`
    const s = scrub(text)
    assert.ok(!s.includes(A))
    assert.ok(!s.includes('alice.vet'))
    assert.ok(!s.includes('12.5'))
    assert.ok(!s.includes('k=1'))
    assert.ok(!s.includes('abandon'))
    assert.ok(s.includes('https://x.io/api/profile/[hex]'))
    assert.equal(cleanReport({ message: '' }), null)
    assert.equal(cleanReport({ message: 'x', route: 'w/1/0' })!.route, '')
})

test('the router matches parameters and wildcards', () => {
    const r = createRouter()
    r.get('/api/bvm/*', () => {})
    r.post('/push/:id', () => {})
    assert.deepEqual(r.match('GET', '/api/bvm/collection/x')!.params, { rest: 'collection/x' })
    assert.deepEqual(r.match('POST', '/push/abc')!.params, { id: 'abc' })
    assert.equal(r.match('GET', '/push/abc'), null)
    assert.equal(r.knows('/push/abc'), true)
})

test('subscriptions are checked, stored and replaced', () => {
    assert.throws(() => validateSubscribe({ ...sub, subscription: { ...sub.subscription, endpoint: 'http://insecure' } }))
    assert.throws(() => validateSubscribe({ ...sub, addresses: ['nope'] }))
    // only browser push services: no posting to any other address
    for (const endpoint of ['https://evil.example/x', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com:8443/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.example/x']) {
        assert.throws(() => validateSubscribe({ ...sub, subscription: { ...sub.subscription, endpoint } }), /push service/)
    }
    for (const endpoint of ['https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/abc', 'https://wns2-par02p.notify.windows.com/w/?token=x']) {
        assert.doesNotThrow(() => validateSubscribe({ ...sub, subscription: { ...sub.subscription, endpoint } }))
    }
    assert.throws(() => validateSubscribe({ ...sub, addresses: Array.from({ length: 21 }, (_, i) => '0x' + String(i).padStart(40, '0')) }))
    const db = openDb(':memory:')
    const store = createStore(db)
    const v = validateSubscribe(sub)
    store.subscribe(v.sub, v.addresses)
    assert.deepEqual(store.addresses(), [A])
    store.subscribe(v.sub, [B])
    assert.deepEqual(store.addresses(), [B])
    assert.equal(store.forAddress(B)[0]!.lang, 'nl')
    assert.deepEqual(store.outgoingAddresses(), [])
    store.subscribe(validateSubscribe({ ...sub, outgoing: true }).sub, [B])
    assert.deepEqual(store.outgoingAddresses(), [B])
    assert.equal(store.forAddress(B)[0]!.outgoing, true)
    store.unsubscribe(v.sub.endpoint)
    assert.equal(store.count(), 0)
    assert.equal(store.addresses().length, 0)
    store.setLastBlock(42)
    assert.equal(store.lastBlock(), 42)
})

test('migrations run once', () => {
    const db = openDb(':memory:')
    const n = (db.prepare('SELECT COUNT(*) AS n FROM migrations').get() as { n: number }).n
    assert.ok(n > 0)
})

test('push messages: one per transaction, known tokens only, no own moves', () => {
    const subs = [{ endpoint: 'e1', keys: { p256dh: 'p', auth: 'a' }, lang: 'nl', addresses: [A, B] }]
    const list: Arrival[] = [
        { txId: 't1', to: A, from: '0x' + 'c'.repeat(40), kind: 'vet', amount: 25n * 10n ** 18n },
        { txId: 't1', to: A, from: '0x' + 'c'.repeat(40), kind: 'token', contract: TOKEN, amount: 5n * 10n ** 18n },
        { txId: 't2', to: A, from: B, kind: 'vet', amount: 1n },
        { txId: 't3', to: A, from: '0x' + 'c'.repeat(40), kind: 'token', contract: '0x' + 'd'.repeat(40), amount: 1n }
    ]
    const msgs = messagesFor(list, a => (a === A ? subs : []), c => (c === TOKEN ? { symbol: 'B3TR', decimals: 18 } : undefined))
    assert.equal(msgs.length, 1)
    assert.equal(msgs[0]!.title, '25 VET + 5 B3TR ontvangen')
    assert.equal(formatAmount(1234567n, 6), '1.2345')
    assert.equal(formatAmount(10n ** 18n, 18), '1')
})

test('outgoing push: only for subscribers that asked, approvals always, own moves never', () => {
    const C = '0x' + 'c'.repeat(40)
    const on = { endpoint: 'e1', keys: { p256dh: 'p', auth: 'a' }, lang: 'nl', outgoing: true, addresses: [A, B] }
    const off = { ...on, endpoint: 'e2', outgoing: false }
    const list: Departure[] = [
        { txId: 't1', from: A, to: C, kind: 'vet', amount: 3n * 10n ** 18n },
        { txId: 't2', from: A, to: B, kind: 'vet', amount: 1n },
        { txId: 't3', from: A, to: C, kind: 'approval', contract: TOKEN },
        { txId: 't4', from: A, to: C, kind: 'vet', amount: 0n }
    ]
    const msgs = outgoingFor(list, a => (a === A ? [on, off] : []), c => (c === TOKEN ? { symbol: 'B3TR', decimals: 18 } : undefined))
    assert.deepEqual(msgs.map(m => [m.sub.endpoint, m.txId, m.url]), [['e1', 't1', '#/activities'], ['e1', 't3', '#/approvals']])
    assert.equal(msgs[0]!.title, '3 VET verstuurd vanaf je adres')
    assert.match(msgs[1]!.title, /B3TR/)
})

test('the relay keeps each key once, wakes a waiting reader, and forgets after 10 minutes', async () => {
    let t = 0
    const relay = createRelay(() => t)
    const id = 'a'.repeat(64)
    const waiting = relay.get(`${id}.resp`, 5000)
    assert.equal(relay.put(id, '{"type":"cert"}', 'https://blackvemarket.com'), 'ok')
    assert.equal(relay.put(id, '{"type":"tx"}', 'https://evil.example'), 'exists')
    assert.deepEqual(await relay.get(id), { body: '{"type":"cert"}', origin: 'https://blackvemarket.com', at: 0 })
    relay.put(`${id}.resp`, '{"payload":{}}', 'https://wallet.blackvemarket.com')
    assert.equal((await waiting)?.body, '{"payload":{}}')
    assert.equal(await relay.get('b'.repeat(64), 10), null)
    t = 11 * 60 * 1000
    assert.equal(await relay.get(id), null)
    assert.equal(relay.size(), 0)
    assert.ok(KEY.test(`${id}.accepted`) && !KEY.test(`${id}.other`) && !KEY.test('../etc'))
})

test('reminders: only the wallet’s own pages, a bounded list, plain text', () => {
    const ok = { id: 'abc12', next: 1000, every: 'week', title: 'Tijd voor B3TR', body: '100 VET → B3TR', url: '#/swap?from=VET&to=B3TR&amt=100&buy=abc12' }
    assert.equal(validateReminders({ endpoint: 'e', reminders: [ok] }).reminders[0]!.url, ok.url)
    assert.throws(() => validateReminders({ endpoint: 'e', reminders: [{ ...ok, url: 'https://evil.example' }] }))
    assert.throws(() => validateReminders({ endpoint: 'e', reminders: [{ ...ok, url: '#/swap?x=<script>' }] }))
    assert.throws(() => validateReminders({ endpoint: 'e', reminders: [{ ...ok, every: 'hour' }] }))
    assert.throws(() => validateReminders({ endpoint: 'e', reminders: Array(21).fill(ok) }))
    assert.equal(validateReminders({ endpoint: 'e', reminders: [{ ...ok, title: 'a\nb'.repeat(60) }] }).reminders[0]!.title, 'a b'.repeat(60).slice(0, 80).trim())
})

test('reminders: the next time skips what was missed', () => {
    const day = 86400000
    const start = Date.UTC(2026, 0, 1)
    assert.equal(nextAfter(start, 'week', start), start + 7 * day)
    assert.equal(nextAfter(start, 'week', start + 20 * day), start + 21 * day)
    assert.equal(nextAfter(start, 'month', start), Date.UTC(2026, 1, 1))
})

test('reminders: due ones are pushed once and set to the next time; they go with the subscription', async () => {
    const db = openDb(':memory:')
    const store = createStore(db)
    const reminders = createReminders(db, store)
    const r = { id: 'b1', next: 1000, every: 'day' as const, title: 'Buy', body: 'x', url: '#/swap' }
    assert.equal(reminders.replace(sub.subscription.endpoint, [r]), false)
    store.subscribe({ ...sub.subscription, lang: 'nl' }, [A])
    assert.equal(reminders.replace(sub.subscription.endpoint, [r]), true)
    const sent: string[] = []
    const send = async (_s: unknown, payload: string) => { sent.push(payload) }
    assert.equal(await reminders.tick(send, 500), 0)
    assert.equal(await reminders.tick(send, 2000), 1)
    assert.equal(JSON.parse(sent[0]!).url, '#/swap')
    assert.equal(await reminders.tick(send, 3000), 0)
    store.unsubscribe(sub.subscription.endpoint)
    assert.equal(await reminders.tick(send, 10 * 86400000), 0)
})

test('phishing: a listed domain covers its subdomains, an allowed one wins', () => {
    assert.deepEqual(domainsOf('a.b.example.com'), ['a.b.example.com', 'b.example.com', 'example.com'])
    const lists = { blocked: new Set(['evil.com', 'pages.dev']), allowed: new Set(['good.pages.dev']) }
    assert.equal(isListed(lists, 'login.evil.com'), true)
    assert.equal(isListed(lists, 'notevil.com'), false)
    assert.equal(isListed(lists, 'good.pages.dev'), false)
    assert.equal(isListed(lists, 'x.pages.dev'), true)
    assert.equal(HOST.test('vebetterdao.org'), true)
    assert.equal(HOST.test('localhost:8080'), false)
    assert.throws(() => parseLists({ blacklist: ['a.com'] }), /too short/)
})

test('phishing: a failed load keeps the last good list', async () => {
    const big = { blacklist: Array.from({ length: 1000 }, (_, i) => `scam${i}.com`), whitelist: [] }
    let fail = false
    const fake = (async () => fail ? new Response('down', { status: 500 }) : Response.json(big)) as typeof fetch
    const p = createPhishing({ fetch: fake })
    await p.load()
    assert.equal(p.check('scam7.com'), true)
    assert.equal(p.check('vechain.co.com'), true)
    fail = true
    await p.load()
    assert.equal(p.check('scam7.com'), true)
})

test('x2earn: rewards add up per address and day, and rank over the last days', async () => {
    const db = openDb(':memory:')
    const day = Date.UTC(2026, 9, 28, 12)
    const word = (v: bigint) => v.toString(16).padStart(64, '0')
    const log = (to: string, b3tr: number, at: number) => ({
        topics: [REWARD_DISTRIBUTED, '0x' + '1'.repeat(64), '0x' + to.slice(2).padStart(64, '0'), '0x' + '2'.repeat(64)],
        data: '0x' + word(BigInt(b3tr) * 10n ** 18n) + word(64n) + word(0n),
        meta: { blockTimestamp: Math.floor(at / 1000) }
    })
    assert.deepEqual(parseReward(log(A, 5, day)), { day: '2026-10-28', receiver: A, b3tr: 5 })
    const logs = [log(A, 5, day), log(A, 3, day), log(B, 10, day), log(B, 1, day - 20 * 86400 * 1000)]
    let served = false
    const fake = (async (url: string | URL, init?: RequestInit) => {
        if (String(url).endsWith('/blocks/best')) return Response.json({ number: 100 })
        const body = JSON.parse(String(init?.body)) as { criteriaSet: { address: string }[], options: { offset: number } }
        assert.equal(body.criteriaSet[0]!.address, REWARDS_POOL)
        const page = served || body.options.offset > 0 ? [] : logs
        served = true
        return Response.json(page)
    }) as typeof fetch
    const x2 = createX2Index({ db, nodes: ['https://node'], fetch: fake, now: () => day })
    await x2.tick()
    const week = x2.board(7, B)
    assert.deepEqual(week.top.map(r => [r.address, r.b3tr, r.actions]), [[B, 10, 1], [A, 8, 2]])
    assert.equal(week.you?.rank, 1)
    assert.equal(x2.board(30, B).top[0]!.b3tr, 11)
    assert.equal(x2.board(7, '0x' + 'c'.repeat(40)).you, null)
})

test('chat: keys need a certificate from the address; only signed sends and reads go through', () => {
    const db = openDb(':memory:')
    const t = 1_800_000_000_000
    const pushed: string[] = []
    const chat = createChat(db, { now: () => t, onMessage: m => pushed.push(m.to) })
    const person = () => {
        const wallet = secp256k1.generatePrivateKey()
        const chatKey = secp256k1.generatePrivateKey()
        const address = addr.fromPublicKey(secp256k1.derivePublicKey(wallet)).toLowerCase()
        const pub = '0x' + secp256k1.derivePublicKey(chatKey).toString('hex')
        const cert: Certificate = { purpose: 'identification', payload: { type: 'text', content: `BlackVault chat key ${pub.slice(2)}` }, domain: 'wallet', timestamp: Math.floor(t / 1000), signer: address }
        cert.signature = '0x' + secp256k1.sign(blake2b256(Certificate.encode(cert)), wallet).toString('hex')
        const sign = (text: string) => '0x' + secp256k1.sign(chatHash(text), chatKey).toString('hex')
        return { address, pub, cert, sign }
    }
    const a = person()
    const b = person()
    assert.deepEqual(chat.publish(a.cert), { address: a.address, key: a.pub })
    // someone else's signature on a's key: refused
    assert.throws(() => chat.publish({ ...a.cert, signer: b.address }), /bad signature/)
    assert.throws(() => chat.publish({ ...a.cert, timestamp: a.cert.timestamp - 3600 }), /too old/)
    const msg = (from: typeof a, to: typeof b, blob = '0xabcd') => ({ from: from.address, to: to.address, blob, at: t, sig: from.sign(`send|${from.address}|${to.address}|${t}|${blob}`) })
    assert.throws(() => chat.send(msg(a, b)), /no chat key/)
    chat.publish(b.cert)
    const sent = chat.send(msg(a, b))
    assert.equal(sent.id, 1)
    assert.deepEqual(pushed, [b.address])
    // signed by b but claiming to be from a
    assert.throws(() => chat.send({ ...msg(b, a), from: a.address, to: b.address }), /not signed/)
    const inbox = (who: typeof a, since = 0) => chat.read({ address: who.address, since, at: t, sig: who.sign(`inbox|${who.address}|${t}`) })
    assert.equal(inbox(b)[0]!.from, a.address)
    assert.equal(inbox(a).length, 1)
    assert.equal(inbox(b, 1).length, 0)
    assert.throws(() => chat.read({ address: b.address, since: 0, at: t, sig: a.sign(`inbox|${b.address}|${t}`) }), /not signed/)
})

test('till: a fixed address, only the secret sets a sale, and a sale goes after 15 minutes', () => {
    let t = 1_000_000
    const tills = createTills(openDb(':memory:'), { now: () => t })
    const { id, secret } = tills.create({ address: A })
    assert.match(id, /^[a-z0-9]{12}$/)
    assert.deepEqual(tills.read(id), { address: A, sale: null })
    assert.throws(() => tills.set(id, { secret: 'wrong', amount: '1', symbol: 'VET' }), /not this till/)
    assert.throws(() => tills.set(id, { secret, amount: '1e5', symbol: 'VET' }), /bad sale/)
    tills.set(id, { secret, amount: '12.5034', symbol: 'VET', address: B })
    assert.deepEqual(tills.read(id), { address: A, sale: { amount: '12.5034', symbol: 'VET', at: t } })
    t += SALE_TTL
    assert.equal(tills.read(id)!.sale, null)
    tills.set(id, { secret, amount: '' })
    assert.equal(tills.read('nope'), null)
    assert.throws(() => tills.create({ address: 'x' }))
})

test('rounds: a new round is pushed once, to the devices that asked', async () => {
    const db = openDb(':memory:')
    const store = createStore(db)
    store.subscribe(validateSubscribe({ ...sub, rounds: true }).sub, [A])
    store.subscribe(validateSubscribe({ ...sub, subscription: { ...sub.subscription, endpoint: 'https://fcm.googleapis.com/fcm/send/other' } }).sub, [B])
    let round = 70
    const sent: { endpoint: string, payload: string }[] = []
    const w = createRoundWatch(db, { nodes: ['n'], round: async () => round, send: async (s, payload) => { sent.push({ endpoint: s.endpoint, payload }) } })
    assert.equal(await w.tick(), 0)
    assert.equal(await w.tick(), 0)
    round = 71
    assert.equal(await w.tick(), 1)
    assert.equal(sent[0]!.endpoint, sub.subscription.endpoint)
    assert.equal(JSON.parse(sent[0]!.payload).title, roundText('nl', 71))
    assert.equal(await w.tick(), 0)
})

test('price alerts: checked, pushed once per crossing, kept per device', async () => {
    assert.throws(() => validatePriceAlerts({ endpoint: 'e', alerts: [{ id: 'a', token: 'nope', kind: 'below', usd: 1, title: 't', url: '#/x' }] }), /bad token/)
    assert.throws(() => validatePriceAlerts({ endpoint: 'e', alerts: [{ id: 'a', token: '', kind: 'below', usd: 1, title: 't', url: 'https://evil' }] }), /bad url/)
    const db = openDb(':memory:')
    const store = createStore(db)
    const v = validateSubscribe(sub)
    store.subscribe(v.sub, v.addresses)
    let vet = 0.03
    const alerts = createPriceAlerts(db, store, async () => new Map([['', vet]]))
    const valid = validatePriceAlerts({ endpoint: v.sub.endpoint, alerts: [{ id: 'a1', token: '0x0000000000000000000000000000000000000000', kind: 'below', usd: 0.025, title: 'VET onder $0,025', url: '#/watchlist' }] })
    assert.equal(alerts.replace('https://fcm.googleapis.com/fcm/send/unknown', valid.alerts), false)
    assert.equal(alerts.replace(v.sub.endpoint, valid.alerts), true)
    const sent: string[] = []
    const send = async (_s: Subscription, payload: string) => { sent.push(JSON.parse(payload).title) }
    assert.equal(await alerts.tick(send), 0)
    vet = 0.02
    assert.equal(await alerts.tick(send), 1)
    assert.equal(await alerts.tick(send), 0)
    // handed over again (the app started): it stays fired
    alerts.replace(v.sub.endpoint, valid.alerts)
    assert.equal(await alerts.tick(send), 0)
    vet = 0.03
    await alerts.tick(send)
    vet = 0.02
    assert.equal(await alerts.tick(send), 1)
    assert.deepEqual(sent, ['VET onder $0,025', 'VET onder $0,025'])
})

test('shop: an order in euros becomes an exact VET amount, settled by the matching transfer only', async () => {
    let t = 5_000_000
    const shops = createShops(openDb(':memory:'), { now: () => t, price: async () => 0.02, eurUsd: async () => 1.1 })
    assert.equal(orderAmount(10, 0.02, 1.1, 7), '550.0007')
    assert.equal(toWei('550.0007'), 550000700000000000000n)
    assert.throws(() => shops.create({ address: 'x', name: 'Shop' }), /bad address/)
    const { id, key } = shops.create({ address: A, name: 'Bakker <Jan>' })
    await assert.rejects(shops.createOrder(id, 'wrong', { ref: 'o1', amount: 10 }), /not this shop/)
    await assert.rejects(shops.createOrder(id, key, { ref: 'o1', amount: 10, returnUrl: 'http://x.y' }), /https/)
    const o = await shops.createOrder(id, key, { ref: 'o1', amount: 10, currency: 'EUR', symbol: 'VET', returnUrl: 'https://shop.example/thanks' })
    assert.equal(o.status, 'pending')
    assert.equal(o.shopName, 'Bakker Jan')
    assert.match(o.amount, /^550\.00\d\d$/)
    const o2 = await shops.createOrder(id, key, { ref: 'o2', amount: 10 })
    assert.notEqual(o2.amount, o.amount)
    assert.deepEqual(shops.open(), [{ address: A, since: t }])
    // the wrong amount, the wrong token, the wrong address: nothing
    assert.equal(shops.settle([{ txId: '0x1', to: A, kind: 'vet', amount: toWei(o.amount) + 1n }]), 0)
    assert.equal(shops.settle([{ txId: '0x2', to: A, kind: 'token', contract: '0x5ef79995fe8a89e0812330e4378eb2660cede699', amount: toWei(o.amount) }]), 0)
    assert.equal(shops.settle([{ txId: '0x3', to: B, kind: 'vet', amount: toWei(o.amount) }]), 0)
    assert.equal(shops.settle([{ txId: '0x4', to: A, kind: 'vet', amount: toWei(o.amount) }]), 1)
    assert.equal(shops.status(id, key, 'o1')!.status, 'paid')
    assert.equal(shops.status(id, key, 'o1')!.txId, '0x4')
    assert.equal(shops.checkout(o.token)!.status, 'paid')
    t += ORDER_TTL
    assert.equal(shops.status(id, key, 'o2')!.status, 'expired')
    assert.deepEqual(shops.open(), [])
})

test('voting rewards: pushed once per ended round, to devices whose addresses earned', async () => {
    const db = openDb(':memory:')
    const store = createStore(db)
    store.subscribe(validateSubscribe({ ...sub, rewards: true }).sub, [A])
    store.subscribe(validateSubscribe({ ...sub, subscription: { ...sub.subscription, endpoint: 'https://fcm.googleapis.com/fcm/send/other' }, addresses: [B], rewards: true }).sub, [B])
    let round = 80
    const asked: number[] = []
    const sent: { endpoint: string, title: string }[] = []
    const w = createRewardWatch(db, {
        nodes: ['n'],
        round: async () => round,
        rewards: async (_n, r, addresses) => { asked.push(r); return new Map(addresses.map(a => [a, a === A ? 12345n * 10n ** 16n : 0n])) },
        send: async (s, payload) => { sent.push({ endpoint: s.endpoint, title: JSON.parse(payload).title }) }
    })
    assert.equal(await w.tick(), 1)
    assert.deepEqual(asked, [79])
    assert.equal(sent[0]!.endpoint, sub.subscription.endpoint)
    assert.equal(sent[0]!.title, rewardText('nl', 79, '123.45'))
    assert.equal(await w.tick(), 0)
    round = 81
    assert.equal(await w.tick(), 1)
    assert.deepEqual(asked, [79, 80])
})

test('validators: a change is pushed once, to the devices whose NFTs are with it', async () => {
    const V = '0x' + 'c'.repeat(40)
    assert.throws(() => validateSubscribe({ ...sub, validators: Array.from({ length: 21 }, (_, i) => '0x' + i.toString(16).padStart(40, '0')) }), /at most 20/)
    const db = openDb(':memory:')
    const store = createStore(db)
    store.subscribe(validateSubscribe({ ...sub, validators: [V, 'nope'] }).sub, [A])
    store.subscribe(validateSubscribe({ ...sub, subscription: { ...sub.subscription, endpoint: 'https://fcm.googleapis.com/fcm/send/other' } }).sub, [B])
    let state: ValidatorState = 'online'
    const titles: string[] = []
    const w = createValidatorWatch(db, { nodes: ['n'], states: async (_n, list) => new Map(list.map(v => [v, state])), send: async (_s, payload) => { titles.push(JSON.parse(payload).title) } })
    assert.equal(await w.tick(), 0)
    state = 'offline'
    assert.equal(await w.tick(), 1)
    assert.equal(await w.tick(), 0)
    state = 'online'
    assert.equal(await w.tick(), 1)
    state = 'exiting'
    assert.equal(await w.tick(), 1)
    assert.deepEqual(titles, [validatorText('offline', 'nl', V), validatorText('online', 'nl', V), validatorText('exiting', 'nl', V)])
    assert.match(titles[0]!, /0xcccc…cccc/)
    // subscribing again without validators stops it
    store.subscribe(validateSubscribe(sub).sub, [A])
    state = 'offline'
    assert.equal(await w.tick(), 0)
})

test('new tokens: the first reading sets what is known, then each new one is pushed once', async () => {
    const db = openDb(':memory:')
    const store = createStore(db)
    store.subscribe(validateSubscribe({ ...sub, tokens: true }).sub, [A])
    const t1 = { address: TOKEN, symbol: 'B3TR', name: 'B3TR' }
    const t2 = { address: '0x' + 'd'.repeat(40), symbol: 'NEW', name: 'New Token' }
    let list = [t1]
    const titles: string[] = []
    const w = createTokenWatch(db, { tokens: async () => list, send: async (_s, payload) => { titles.push(JSON.parse(payload).title) } })
    assert.equal(await w.tick(), 0)
    list = [t1, t2]
    assert.equal(await w.tick(), 1)
    assert.equal(await w.tick(), 0)
    assert.deepEqual(titles, [tokenText('nl', t2)])
    // a registry that suddenly holds dozens more: not news
    list = [t1, t2, ...Array.from({ length: 30 }, (_, i) => ({ address: '0x' + i.toString(16).padStart(40, 'e'), symbol: 'X', name: 'X' }))]
    assert.equal(await w.tick(), 0)
})
