import { BigNumber } from 'bignumber.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import localizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)

let locale = 'en-US'

/**
 * Numbers follow the app's language (App.vue), so token amounts and money read alike: "1.234,5 VET" and
 * "€ 1.234,50" in Dutch. Only for display: amounts typed in or sent are plain ("1234.5").
 */
export function setNumberLocale(lang: string) {
    locale = lang
    const parts = new Intl.NumberFormat(lang).formatToParts(12345.6)
    const part = (type: string, fallback: string) => parts.find(p => p.type === type)?.value ?? fallback
    BigNumber.config({
        FORMAT: {
            ...BigNumber.config(undefined as unknown as BigNumber.Config).FORMAT,
            decimalSeparator: part('decimal', '.'),
            groupSeparator: part('group', ','),
            groupSize: 3
        }
    })
}

/** the locale for Intl.NumberFormat / toLocaleString */
export function numberLocale() {
    return locale
}

/** a number with a fixed count of decimals, in the app's language ("3,5" in Dutch): for percentages */
export function fixed(v: number, digits: number): string {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }).format(v)
}

/** an amount as a plain number for a field ("1234.5"): no grouping, a point for decimals */
export function plainUnits(val: bigint | string, decimals: number): string {
    return new BigNumber(val.toString()).div('1' + '0'.repeat(decimals)).toFixed()
}

export function decimalSeparator() {
    return BigNumber.config(undefined as unknown as BigNumber.Config).FORMAT!.decimalSeparator!
}

export type FormatAmountOptions = {
    unit?: number
    fixed?: number
    fullPrecision?: boolean
}

export type FormatAmountResult = {
    int: string
    dec?: string
    sep: string
}

export function formatAmount(val: BigNumber.Value, opts?: FormatAmountOptions): FormatAmountResult | null {
    try {
        opts = opts || {}
        let bn = new BigNumber(val)
        if (opts.unit) {
            bn = bn.div('1' + '0'.repeat(opts.unit))
        }

        // NaN or Infinite is not valid
        if (!bn.isFinite()) {
            return null
        }

        const sep = decimalSeparator()

        if (opts.fullPrecision) {
            const [int = '', dec] = bn.toFormat().split(sep)
            if (typeof opts.fixed !== 'number' || opts.fixed <= 0) {
                return { int, dec, sep }
            }
            if (dec) {
                if (dec.length < opts.fixed) {
                    return { int, dec: dec + '0'.repeat(opts.fixed - dec.length), sep }
                }
                return { int, dec, sep }
            }

            return { int, dec: '0'.repeat(opts.fixed), sep }
        }

        const [int = '', dec] = (typeof opts.fixed === 'number' ? bn.toFormat(opts.fixed, BigNumber.ROUND_FLOOR) : bn.toFormat()).split(sep)
        return { int, dec, sep }
    } catch {
        return null
    }
}

/** an amount in a token's smallest unit as text: up to 4 decimals, trailing zeros dropped */
export function formatUnits(val: bigint | string, decimals: number, maxDecimals = 4): string {
    const bn = new BigNumber(val.toString()).div('1' + '0'.repeat(decimals))
    if (!bn.isFinite()) {
        return '?'
    }
    // tiny but not zero: show that it is not zero
    if (!bn.isZero() && bn.abs().lt(new BigNumber(10).pow(-maxDecimals))) {
        return '< ' + new BigNumber(10).pow(-maxDecimals).toFormat()
    }
    return new BigNumber(bn.toFixed(maxDecimals, BigNumber.ROUND_FLOOR)).toFormat()
}

export function toWei(v: string, decimals: number) {
    return new BigNumber(v)
        .times(`1${'0'.repeat(decimals)}`)
        .toFixed(0, BigNumber.ROUND_FLOOR)
}

export type FormatDateOptions = {
    relative?: boolean
}

export function formatDate(date: number, opts?: FormatDateOptions) {
    opts = opts || {}
    if (!opts.relative) {
        return dayjs(date).format('L HH:mm:ss')
    }
    const d = dayjs(date)
    const now = dayjs()
    // "2 minutes ago" within the hour (Sync2 used toNow(), which reads "in x minutes" for past dates)
    if (now.diff(d, 'minute') < 60) {
        return d.fromNow()
    }
    const days = now.startOf('day').diff(d.startOf('day'), 'day')
    if (days <= 1) {
        // "today, 14:32" / "yesterday, 09:10" in the app's language
        const word = new Intl.RelativeTimeFormat(dayjs.locale(), { numeric: 'auto' }).format(-days, 'day')
        return `${word.charAt(0).toUpperCase()}${word.slice(1)}, ${d.format('HH:mm')}`
    }
    if (days < 7) {
        return d.format('dddd HH:mm')
    }
    return d.format(d.year() === now.year() ? 'D MMM' : 'D MMM YYYY')
}
