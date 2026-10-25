// Token prices from BetterSwap (USD, with 1h/24h change and hourly history), turned into
// euros with BlackVeMarket's rates. Mainnet only.
import axios from 'axios'

export namespace Prices {
    export type Stat = {
        /** USD per token */
        price: number
        /** percent change over 24 hours */
        change24h: number
    }
    export type Point = { time: number, price: number }
    export type Currency = 'EUR' | 'USD'
}

// BetterSwap sends no CORS headers: the dev server proxies it, a build needs BETTERSWAP_API_URL
// pointing at a proxy (or falls back to BlackVeMarket's VET/VTHO/B3TR rates)
const betterswap = axios.create({
    baseURL: import.meta.env.BETTERSWAP_API_URL || (import.meta.env.QUASAR_DEV ? '/betterswap-api' : 'https://www.betterswap.io/api'),
    timeout: 15 * 1000
})
const bvm = axios.create({
    baseURL: import.meta.env.BVM_API_URL || (import.meta.env.QUASAR_DEV ? '/bvm-api' : 'https://blackvemarket.com/api'),
    timeout: 15 * 1000
})

const ZERO = '0x0000000000000000000000000000000000000000'
const ENERGY = '0x0000000000000000000000000000456e65726779'
const B3TR = '0x5ef79995fe8a89e0812330e4378eb2660cede699'

/** BetterSwap names VET by the empty address */
const key = (address: string | null | undefined) => {
    const a = (address || '').toLowerCase()
    return a === ZERO ? '' : a
}

type Rates = { usd: Record<string, number>, eur: Record<string, number> }

const statCache = new Map<string, { at: number, stat: Prices.Stat | null }>()
const historyCache = new Map<string, { at: number, points: Prices.Point[] }>()
let ratesCache: { at: number, rates: Rates } | null = null

async function rates(): Promise<Rates> {
    if (ratesCache && ratesCache.at > Date.now() - 5 * 60 * 1000) {
        return ratesCache.rates
    }
    const resp = await bvm.get<Rates>('/rates')
    ratesCache = { at: Date.now(), rates: resp.data }
    return resp.data
}

export function build() {
    return {
        /** euros per dollar (1 when asked for USD) */
        async fx(currency: Prices.Currency): Promise<number> {
            if (currency === 'USD') {
                return 1
            }
            try {
                const r = await rates()
                return r.usd.VET ? r.eur.VET! / r.usd.VET : 0.92
            } catch {
                return 0.92
            }
        },
        /** USD prices and 24h change by token address (VET: the zero address); cached a minute */
        async stats(addresses: Array<string | null | undefined>): Promise<Record<string, Prices.Stat>> {
            const keys = [...new Set(addresses.map(key))]
            const fresh = Date.now() - 60 * 1000
            const missing = keys.filter(k => !(statCache.get(k)?.at! > fresh))
            if (missing.length) {
                try {
                    const resp = await betterswap.get<{ tokenAddress: string, price: number, priceChange24hPercent: number }[]>(
                        '/token-prices/stats', { params: { addresses: missing.join(',') } })
                    const found = new Map(resp.data.map(s => [s.tokenAddress.toLowerCase(), s]))
                    for (const k of missing) {
                        const s = found.get(k)
                        statCache.set(k, { at: Date.now(), stat: s && s.price > 0 ? { price: s.price, change24h: s.priceChange24hPercent || 0 } : null })
                    }
                } catch {
                    // BetterSwap unreachable: VET, VTHO and B3TR from BlackVeMarket, without change
                    try {
                        const r = await rates()
                        const bySymbol: Record<string, number | undefined> = { '': r.usd.VET, [ENERGY]: r.usd.VTHO, [B3TR]: r.usd.B3TR }
                        for (const k of missing) {
                            const price = bySymbol[k]
                            statCache.set(k, { at: Date.now(), stat: price ? { price, change24h: 0 } : null })
                        }
                    } catch { }
                }
            }
            const out: Record<string, Prices.Stat> = {}
            for (const k of keys) {
                const s = statCache.get(k)?.stat
                if (s) {
                    out[k === '' ? ZERO : k] = s
                }
            }
            return out
        },
        /** hourly USD prices over the last hours, by token address; cached 10 minutes */
        async history(addresses: Array<string | null | undefined>, hours = 168): Promise<Record<string, Prices.Point[]>> {
            const keys = [...new Set(addresses.map(key))]
            const fresh = Date.now() - 10 * 60 * 1000
            const missing = keys.filter(k => !(historyCache.get(`${k}:${hours}`)?.at! > fresh))
            if (missing.length) {
                try {
                    const resp = await betterswap.get<{ tokenAddress: string, priceHistory: { timestamp: number, price: number }[] }[]>(
                        '/token-prices/history', { params: { addresses: missing.join(','), hours } })
                    for (const h of resp.data) {
                        historyCache.set(`${h.tokenAddress.toLowerCase()}:${hours}`, {
                            at: Date.now(),
                            points: h.priceHistory.map(p => ({ time: p.timestamp, price: p.price }))
                        })
                    }
                } catch {
                    // no chart then
                }
            }
            const out: Record<string, Prices.Point[]> = {}
            for (const k of keys) {
                const h = historyCache.get(`${k}:${hours}`)
                if (h) {
                    out[k === '' ? ZERO : k] = h.points
                }
            }
            return out
        }
    }
}
