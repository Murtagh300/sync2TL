import { BigNumber } from 'bignumber.js'
import type { Service } from 'boot/services'
import type { Prices } from 'boot/services/prices'
import { genesises } from 'src/consts'
import { visibleTokens } from './tokens'

/**
 * What a wallet's tokens are worth: per token and in total, the 24 hour change and a
 * 7 day line (today's balances at each hour's prices). Mainnet only; NFTs are valued
 * separately, at collection floors.
 */

export type Holding = {
    spec: M.TokenSpec
    /** in the token's smallest unit, over all addresses of the wallet */
    amount: string
    /** USD; 0 when the token has no price */
    usd: number
    change24h: number
}

export type Portfolio = {
    holdings: Holding[]
    totalUsd: number
    /** percent */
    change24h: number
    /** hourly USD values, oldest first */
    series: number[]
}

const units = (amount: string, decimals: number) => new BigNumber(amount).div(new BigNumber(10).pow(decimals)).toNumber()

/** the portfolio of one wallet, or of several together ("All wallets"); mainnet only */
export async function walletPortfolio(svc: Service, walletOrWallets: M.Wallet | M.Wallet[], opts: { withSeries?: boolean, hours?: number } = {}): Promise<Portfolio | null> {
    const wallets = (Array.isArray(walletOrWallets) ? walletOrWallets : [walletOrWallets]).filter(w => w.gid === genesises.main.id)
    if (!wallets.length) {
        return null
    }
    const wallet = { ...wallets[0]!, meta: { ...wallets[0]!.meta, addresses: [...new Set(wallets.flatMap(w => w.meta.addresses))] } }
    const bc = svc.bc(wallet.gid)
    // the tokens each address shows, summed over addresses
    const perAddress = await Promise.all(wallet.meta.addresses.map(async address => {
        const specs = await visibleTokens(svc, wallet.gid, address)
        const balances = await Promise.all(specs.map(s => bc.balanceOf(address, s).catch(() => '0')))
        return specs.map((spec, i) => ({ spec, amount: balances[i] || '0' }))
    }))
    const sums = new Map<string, { spec: M.TokenSpec, amount: BigNumber }>()
    for (const { spec, amount } of perAddress.flat()) {
        const prev = sums.get(spec.symbol)
        sums.set(spec.symbol, { spec, amount: (prev?.amount || new BigNumber(0)).plus(amount) })
    }
    const list = [...sums.values()].filter(h => h.amount.gt(0) || h.spec.permanent)
    const stats = await svc.prices.stats(list.map(h => h.spec.address))
    const statOf = (spec: M.TokenSpec): Prices.Stat | undefined =>
        stats[(spec.address || '0x0000000000000000000000000000000000000000').toLowerCase()]

    const holdings: Holding[] = list.map(h => {
        const stat = statOf(h.spec)
        const amount = h.amount.toFixed(0)
        return {
            spec: h.spec,
            amount,
            usd: stat ? units(amount, h.spec.decimals) * stat.price : 0,
            change24h: stat?.change24h || 0
        }
    }).sort((a, b) => b.usd - a.usd)

    const totalUsd = holdings.reduce((s, h) => s + h.usd, 0)
    // what the same balances were worth 24 hours ago
    const before = holdings.reduce((s, h) => s + (h.change24h > -100 ? h.usd / (1 + h.change24h / 100) : 0), 0)
    const change24h = before > 0 ? (totalUsd / before - 1) * 100 : 0

    let series: number[] = []
    if (opts.withSeries) {
        const priced = holdings.filter(h => h.usd > 0)
        const history = await svc.prices.history(priced.map(h => h.spec.address), opts.hours ?? 168)
        const lines = priced.map(h => ({
            amount: units(h.amount, h.spec.decimals),
            points: history[(h.spec.address || '0x0000000000000000000000000000000000000000').toLowerCase()] || []
        })).filter(l => l.points.length)
        const times = lines.length ? lines.reduce((a, b) => (a.points.length >= b.points.length ? a : b)).points.map(p => p.time) : []
        series = times.map(t => lines.reduce((sum, l) => {
            // the last known price at or before t
            let price = l.points[0]!.price
            for (const p of l.points) {
                if (p.time > t) break
                price = p.price
            }
            return sum + l.amount * price
        }, 0))
        if (series.length) {
            series.push(totalUsd)
        }
    }
    return { holdings, totalUsd, change24h, series }
}
