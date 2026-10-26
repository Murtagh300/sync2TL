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
import { openDb } from '../src/db.ts'
import { createStore, validateSubscribe } from '../src/push/store.ts'
import { formatAmount, messagesFor, type Arrival } from '../src/push/watcher.ts'

const A = '0x' + 'a'.repeat(40)
const B = '0x' + 'b'.repeat(40)
const TOKEN = '0x5ef79995fe8a89e0812330e4378eb2660cede699'
const sub = { subscription: { endpoint: 'https://push.example.com/abc123', keys: { p256dh: 'BOrAb0dEAbCdEfGh', auth: 'aBcDeFgHiJk' } }, addresses: [A], lang: 'nl' }

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
    const call = async (query: string) => {
        let body = ''
        const headers: Record<string, string> = {}
        const res = { statusCode: 0, setHeader: (k: string, v: string) => { headers[k] = v }, end: (b: string) => { body = b } }
        const url = new URL(`http://x/api/betterswap/tokens${query}`)
        await proxy({ req: {} as never, res: res as never, url, params: { rest: 'tokens' }, ip: '1' }, 'betterswap')
        return { status: res.statusCode, body: JSON.parse(body), cache: headers['X-Cache'] }
    }
    const first = await call('?b=2&a=1')
    const second = await call('?a=1&b=2')
    upstream.close()
    assert.equal(first.status, 200)
    assert.equal(first.body.url, '/tokens?a=1&b=2')
    assert.equal(second.cache, 'hit')
    assert.equal(hits, 1)
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
    assert.throws(() => validateSubscribe({ ...sub, addresses: Array.from({ length: 21 }, (_, i) => '0x' + String(i).padStart(40, '0')) }))
    const db = openDb(':memory:')
    const store = createStore(db)
    const v = validateSubscribe(sub)
    store.subscribe(v.sub, v.addresses)
    assert.deepEqual(store.addresses(), [A])
    store.subscribe(v.sub, [B])
    assert.deepEqual(store.addresses(), [B])
    assert.equal(store.forAddress(B)[0]!.lang, 'nl')
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
