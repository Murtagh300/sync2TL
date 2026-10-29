import type { DatabaseSync } from 'node:sqlite'
import type { Store, Subscription } from './store.ts'

/**
 * Token price alerts that reach a closed app: a device hands over its rules (a token, above or below
 * a price), the server reads BetterSwap's prices every two minutes and pushes once per crossing.
 * Prices are in dollars, as BetterSwap has them: the device turns its own currency into dollars
 * each time it hands the list over (every start), and writes the text in its own language.
 */

export const MAX_PRICE_ALERTS = 20

export type PriceAlert = { id: string, token: string, kind: 'below' | 'above', usd: number, title: string, url: string }

const text = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max).trim() : ''
const URL_OK = /^#\/[a-z0-9/-]*(\?[a-z0-9=&%._-]*)?$/i

export function validatePriceAlerts(raw: unknown): { endpoint: string, alerts: PriceAlert[] } {
    const body = (raw || {}) as { endpoint?: unknown, alerts?: unknown }
    if (typeof body.endpoint !== 'string' || !body.endpoint) throw new Error('endpoint missing')
    if (!Array.isArray(body.alerts)) throw new Error('alerts missing')
    if (body.alerts.length > MAX_PRICE_ALERTS) throw new Error(`at most ${MAX_PRICE_ALERTS} alerts`)
    const alerts = body.alerts.map((r: unknown) => {
        const o = (r || {}) as Record<string, unknown>
        const id = text(o.id, 32)
        const token = text(o.token, 42).toLowerCase()
        const usd = Number(o.usd)
        const url = text(o.url, 300)
        if (!/^[a-z0-9]+$/i.test(id)) throw new Error('bad id')
        // VET is the zero address, or empty as BetterSwap names it
        if (token && !/^0x[0-9a-f]{40}$/.test(token)) throw new Error('bad token')
        if (o.kind !== 'below' && o.kind !== 'above') throw new Error('bad kind')
        if (!Number.isFinite(usd) || usd <= 0) throw new Error('bad price')
        if (!URL_OK.test(url)) throw new Error('bad url')
        const title = text(o.title, 120)
        if (!title) throw new Error('title missing')
        return { id, token: token === '0x0000000000000000000000000000000000000000' ? '' : token, kind: o.kind, usd, title, url } as PriceAlert
    })
    return { endpoint: body.endpoint, alerts }
}

/** BetterSwap's USD prices for these tokens ('' is VET) */
export function betterswapPrices(base: string) {
    return async (tokens: string[]): Promise<Map<string, number>> => {
        const r = await fetch(`${base}/token-prices/stats?addresses=${tokens.join(',')}`, { signal: AbortSignal.timeout(15000) })
        if (!r.ok) throw new Error(`betterswap ${r.status}`)
        const list = await r.json() as { tokenAddress: string, price: number }[]
        return new Map(list.filter(x => x.price > 0).map(x => [x.tokenAddress.toLowerCase(), x.price]))
    }
}

export function createPriceAlerts(db: DatabaseSync, store: Store, prices: (tokens: string[]) => Promise<Map<string, number>>) {
    const clear = db.prepare('DELETE FROM price_alerts WHERE endpoint = ?')
    const insert = db.prepare('INSERT INTO price_alerts (endpoint, id, token, kind, usd, title, url, fired) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const old = db.prepare('SELECT id, token, kind, usd, fired FROM price_alerts WHERE endpoint = ?')
    const all = db.prepare(`SELECT a.endpoint, a.id, a.token, a.kind, a.usd, a.title, a.url, a.fired, s.keys, s.lang FROM price_alerts a
        JOIN subscriptions s ON s.endpoint = a.endpoint`)
    const setFired = db.prepare('UPDATE price_alerts SET fired = ? WHERE endpoint = ? AND id = ?')

    return {
        /** a subscribed device's list, replaced; an unchanged rule keeps whether it fired */
        replace(endpoint: string, alerts: PriceAlert[]): boolean {
            if (!store.has(endpoint)) return false
            const before = new Map((old.all(endpoint) as { id: string, token: string, kind: string, usd: number, fired: number }[]).map(r => [r.id, r]))
            db.exec('BEGIN')
            try {
                clear.run(endpoint)
                for (const a of alerts) {
                    const b = before.get(a.id)
                    const same = b && b.token === a.token && b.kind === a.kind && Math.abs(b.usd - a.usd) / a.usd < 0.05
                    insert.run(endpoint, a.id, a.token, a.kind, a.usd, a.title, a.url, same ? b.fired : 0)
                }
                db.exec('COMMIT')
            } catch (err) {
                db.exec('ROLLBACK')
                throw err
            }
            return true
        },
        /** read the prices, push the rules that now hold and didn't before */
        async tick(send: (sub: Subscription, payload: string) => Promise<void>) {
            const rows = all.all() as { endpoint: string, id: string, token: string, kind: string, usd: number, title: string, url: string, fired: number, keys: string, lang: string }[]
            if (!rows.length) return 0
            const price = await prices([...new Set(rows.map(r => r.token))])
            let sent = 0
            for (const r of rows) {
                const p = price.get(r.token)
                if (p === undefined) continue
                const holds = r.kind === 'below' ? p <= r.usd : p >= r.usd
                if (holds === !!r.fired) continue
                setFired.run(holds ? 1 : 0, r.endpoint, r.id)
                if (!holds) continue
                try {
                    await send({ endpoint: r.endpoint, keys: JSON.parse(r.keys), lang: r.lang }, JSON.stringify({ title: r.title, body: 'BlackVault', url: r.url, tag: `price:${r.id}` }))
                    sent++
                } catch (err) {
                    console.warn('[push] price alert:', (err as Error).message)
                }
            }
            return sent
        }
    }
}
