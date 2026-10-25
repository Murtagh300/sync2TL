import type { BVM } from 'boot/services/bvm'

/**
 * Rarity and price hints for an NFT: which trait is rarest, which one the market values
 * most, and sensible listing prices from the floor, its trait floors and recent sales.
 */

export type Suggestion = { key: 'floor' | 'trait' | 'sales', price: number, currency: string }

const num = (s?: string | null) => parseFloat(String(s ?? '').replace(/,/g, ''))

/** "60 VET" → [60, 'VET'] */
export function parsePrice(text?: string | null): [number, string] | null {
    const m = /^([\d.,]+)\s*([A-Za-z0-9]+)$/.exec(String(text ?? '').trim())
    if (!m) return null
    const v = num(m[1])
    return isFinite(v) && v > 0 ? [v, m[2]!] : null
}

export type RichTrait = BVM.Trait & { traitFloorRaw?: string, traitFloorCurrency?: string, traitListed?: number }

/**
 * the rarest trait (lowest share) and the one with the highest floor; trait floors over ten
 * times the collection floor are one-off asking prices, not value, and are left out
 */
export function traitHighlights(traits: RichTrait[], collectionFloor?: number | null): { rarest: RichTrait | null, valuable: RichTrait | null } {
    const withShare = traits.filter(t => typeof t.percentage === 'number')
    const rarest = withShare.length ? withShare.reduce((a, b) => (b.percentage! < a.percentage! ? b : a)) : null
    const priced = traits.map(t => ({ t, p: parsePrice(t.traitFloor) }))
        .filter(x => x.p && (!collectionFloor || x.p[0] <= collectionFloor * 10))
    const valuable = priced.length ? priced.reduce((a, b) => (b.p![0] > a.p![0] ? b : a)).t : null
    return { rarest, valuable }
}

/** median of a list */
function median(values: number[]): number {
    const s = [...values].sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** listing prices to start from, highest-evidence first */
export function listingSuggestions(nft: BVM.NFT, recentSales: BVM.FeedItem[]): Suggestion[] {
    const out: Suggestion[] = []
    const floor = nft.intelligence?.collection
    if (floor?.floorValue) {
        out.push({ key: 'floor', price: floor.floorValue, currency: floor.floorCurrency || 'VET' })
    }
    const { valuable } = traitHighlights(nft.traits as RichTrait[], floor?.floorValue)
    const tp = parsePrice(valuable?.traitFloor)
    if (tp && (!floor?.floorValue || tp[0] > floor.floorValue)) {
        out.push({ key: 'trait', price: tp[0], currency: tp[1] })
    }
    const sales = recentSales.filter(s => s.kind === 'sale').map(s => parsePrice(s.price)).filter((p): p is [number, string] => !!p)
    const currency = floor?.floorCurrency || sales[0]?.[1]
    const same = sales.filter(s => s[1] === currency).map(s => s[0])
    if (same.length >= 2) {
        out.push({ key: 'sales', price: Math.round(median(same) * 100) / 100, currency: currency! })
    }
    return out
}
