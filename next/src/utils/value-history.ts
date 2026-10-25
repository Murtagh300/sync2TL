import { readSnapshot, writeSnapshot } from './snapshot'

/**
 * One total value per day, saved whenever the portfolio is computed, so the history grows
 * past the 30 days BetterSwap's prices reach.
 */
export type DayValue = { day: string, usd: number }

const key = (scope: string) => `days:${scope}`

export function recordDayValue(scope: string, usd: number) {
    const day = new Date().toISOString().slice(0, 10)
    const list = readSnapshot<DayValue[]>(key(scope))?.value || []
    const rest = list.filter(d => d.day !== day)
    // two years of days at most
    writeSnapshot(key(scope), [...rest, { day, usd }].sort((a, b) => a.day.localeCompare(b.day)).slice(-730))
}

export function dayValues(scope: string): DayValue[] {
    return readSnapshot<DayValue[]>(key(scope))?.value || []
}
