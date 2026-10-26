import type { Service } from 'boot/services'
import type { BVM } from 'boot/services/bvm'
import { genesises } from 'src/consts'

/**
 * Price alerts and the watchlist. The wallet checks them while it is open (at start and
 * every few minutes); BlackVeMarket push alerts would reach a closed app too, but need
 * a signed-in session there.
 */

export type Watchlist = {
    /** collection slugs */
    collections: string[]
    wallets: string[]
}

export type AlertRule = {
    id: string
    /** a collection's floor ... */
    slug: string
    /** ... or a token's price (its address; VET is the zero address), in currency */
    token?: string
    name: string
    kind: 'below' | 'above'
    value: number
    currency: string
}

/** whether a rule's condition holds at this value */
export const ruleHolds = (rule: AlertRule, value: number) => rule.kind === 'below' ? value <= rule.value : value >= rule.value

type AlertState = {
    /** whether a rule's condition held at the last check, so it fires once per crossing */
    fired: Record<string, boolean>
    /** offers on the NFTs of each address at the last check */
    offers: Record<string, number>
}

export const emptyWatchlist = (): Watchlist => ({ collections: [], wallets: [] })

export function collectionBySlug(collections: Record<string, BVM.Collection>, slug: string) {
    return Object.values(collections).find(c => c.slug === slug)
}

export type AlertMessage = { text: string, slug?: string }

/** the alerts that fire now; their state is saved, so each fires once per change */
export async function checkAlerts(svc: Service, t: (key: string, params?: Record<string, unknown>) => string): Promise<AlertMessage[]> {
    const [rules, state, wallets] = await Promise.all([
        svc.config.getJSON<AlertRule[]>('alerts', []),
        svc.config.getJSON<AlertState>('alert-state', { fired: {}, offers: {} }),
        svc.wallet.getByGid(genesises.main.id)
    ])
    const messages: AlertMessage[] = []

    // token prices: in the rule's currency
    const tokenRules = rules.filter(r => r.token)
    if (tokenRules.length) {
        try {
            const stats = await svc.prices.stats(tokenRules.map(r => r.token))
            for (const rule of tokenRules) {
                const s = stats[rule.token!.toLowerCase()]
                if (!s) continue
                const price = s.price * await svc.prices.fx(rule.currency === 'USD' ? 'USD' : 'EUR')
                const holds = ruleHolds(rule, price)
                if (holds && !state.fired[rule.id]) {
                    const sign = rule.currency === 'USD' ? '$' : '€'
                    messages.push({
                        text: t(rule.kind === 'below' ? 'alerts.msg_token_below' : 'alerts.msg_token_above', {
                            name: rule.name, price: `${sign}${price.toPrecision(4)}`, value: `${sign}${rule.value}`
                        })
                    })
                }
                state.fired[rule.id] = holds
            }
        } catch {
            // prices unreachable: check again next time
        }
    }

    const floorRules = rules.filter(r => !r.token)
    if (floorRules.length) {
        const collections = await svc.bvm.collections()
        for (const rule of floorRules) {
            const c = collectionBySlug(collections, rule.slug)
            if (!c || c.floorValue == null || c.floorCurrency !== rule.currency) {
                continue
            }
            const holds = ruleHolds(rule, c.floorValue)
            if (holds && !state.fired[rule.id]) {
                messages.push({
                    text: t(rule.kind === 'below' ? 'alerts.msg_fired_below' : 'alerts.msg_fired_above', {
                        name: c.name, floor: `${c.floorValue} ${c.floorCurrency}`, value: `${rule.value} ${rule.currency}`
                    }),
                    slug: rule.slug
                })
            }
            state.fired[rule.id] = holds
        }
    }

    // offers on the NFTs this wallet holds
    const addresses = [...new Set(wallets.flatMap(w => w.meta.addresses.map(a => a.toLowerCase())))]
    for (const address of addresses) {
        try {
            const h = await svc.bvm.holdings(address, { limit: 1 })
            const now = h.summary.offers || 0
            const before = state.offers[address]
            if (before !== undefined && now > before) {
                messages.push({ text: t('alerts.msg_new_offers', { n: now - before }) })
            }
            state.offers[address] = now
        } catch {
            // BlackVeMarket unreachable: check again next time
        }
    }

    await svc.config.setJSON('alert-state', state)
    return messages
}

/** also as a system notification when the app is in the background and may notify */
export function notifySystem(text: string) {
    try {
        if (document.visibilityState === 'visible' || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return
        }
        void navigator.serviceWorker?.getRegistration().then(reg => {
            if (reg) {
                return reg.showNotification('BlackVault', { body: text, icon: 'icons/favicon-128x128.png' })
            }
             
            new Notification('BlackVault', { body: text })
        })
    } catch {
        // notifications are a bonus
    }
}
