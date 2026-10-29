/**
 * Candles from hourly prices (BetterSwap's history has a point per hour): each candle opens at
 * the close before it, so a one-hour candle still shows how the hour went. With a moving average
 * and RSI, the two indicators people read most.
 */

export type Candle = { time: number, open: number, high: number, low: number, close: number }

/** hourly points as candles of `bucket` milliseconds */
export function toCandles(points: { time: number, price: number }[], bucket: number): Candle[] {
    const out: Candle[] = []
    let prev: number | null = null
    for (const p of points) {
        const time = Math.floor(p.time / bucket) * bucket
        const last = out[out.length - 1]
        if (last && last.time === time) {
            last.high = Math.max(last.high, p.price)
            last.low = Math.min(last.low, p.price)
            last.close = p.price
        } else {
            const open = prev ?? p.price
            out.push({ time, open, high: Math.max(open, p.price), low: Math.min(open, p.price), close: p.price })
        }
        prev = p.price
    }
    return out
}

/** the simple moving average over n values; null until there are n */
export function sma(values: number[], n: number): (number | null)[] {
    let sum = 0
    return values.map((v, i) => {
        sum += v
        if (i >= n) sum -= values[i - n]!
        return i >= n - 1 ? sum / n : null
    })
}

/** Wilder's relative strength index over n periods, of the last value; null with too little data */
export function rsi(closes: number[], n = 14): number | null {
    if (closes.length <= n) return null
    let gain = 0
    let loss = 0
    for (let i = 1; i <= n; i++) {
        const d = closes[i]! - closes[i - 1]!
        if (d > 0) gain += d
        else loss -= d
    }
    gain /= n
    loss /= n
    for (let i = n + 1; i < closes.length; i++) {
        const d = closes[i]! - closes[i - 1]!
        gain = (gain * (n - 1) + Math.max(d, 0)) / n
        loss = (loss * (n - 1) + Math.max(-d, 0)) / n
    }
    if (loss === 0) return gain === 0 ? 50 : 100
    return 100 - 100 / (1 + gain / loss)
}

/** the candle size for a range: an hour for a day, four for a week, a day for a month */
export function bucketFor(hours: number): number {
    const h = 3600 * 1000
    return hours <= 24 ? h : hours <= 168 ? 4 * h : 24 * h
}
