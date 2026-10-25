export type FloorPoint = { time: number, value: number, currency: string }

const DAY = 24 * 3600 * 1000

/**
 * one floor per day over the last days, up to today: BlackVeMarket records a day only when
 * something changed, so a missing day keeps the floor of the day before. One currency: the
 * latest one's.
 */
export function dailyFloors(points: FloorPoint[], days: number, now: number): FloorPoint[] {
    const currency = points[points.length - 1]?.currency
    const same = points.filter(p => p.currency === currency).sort((a, b) => a.time - b.time)
    if (!same.length) return []
    const from = now - days * DAY
    // the floor at the start: the last one recorded before it (or the first ever)
    let k = 0
    let value = same[0]!.value
    while (k < same.length && same[k]!.time <= from) {
        value = same[k]!.value
        k++
    }
    const out: FloorPoint[] = []
    for (let t = Math.max(from, same[0]!.time); t <= now; t += DAY) {
        while (k < same.length && same[k]!.time <= t) {
            value = same[k]!.value
            k++
        }
        out.push({ time: t, value, currency: currency! })
    }
    // a floor recorded since the last whole day: today's
    if (k < same.length) {
        out.push({ time: now, value: same[same.length - 1]!.value, currency: currency! })
    }
    return out
}
