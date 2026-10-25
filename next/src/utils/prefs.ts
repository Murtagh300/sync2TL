import { reactive, watch } from 'vue'

/**
 * Small per-device preferences, kept in localStorage: hidden balances, the fiat currency
 * and the accent color.
 */

export type Accent = 'mint' | 'blue' | 'violet' | 'amber' | 'rose'

export const accents: Record<Accent, { color: string, soft: string }> = {
    mint: { color: '#6ee7b7', soft: 'rgba(110, 231, 183, 0.10)' },
    blue: { color: '#7cc4ff', soft: 'rgba(124, 196, 255, 0.10)' },
    violet: { color: '#b9a6ff', soft: 'rgba(185, 166, 255, 0.10)' },
    amber: { color: '#fcd34d', soft: 'rgba(252, 211, 77, 0.10)' },
    rose: { color: '#fda4af', soft: 'rgba(253, 164, 175, 0.10)' }
}

type Prefs = {
    hideBalances: boolean
    currency: 'EUR' | 'USD'
    accent: Accent
    haptics: boolean
    /** lock after this many minutes in the background; -1: never */
    autoLockMinutes: number
    /** text size, 1 = normal */
    textScale: number
    highContrast: boolean
    /** an NFT image behind the home screen ('' for none) */
    homeBackground: string
}

const KEY = 'bv-prefs'

function load(): Prefs {
    const defaults: Prefs = { hideBalances: false, currency: 'EUR', accent: 'mint', haptics: true, autoLockMinutes: 5, textScale: 1, highContrast: false, homeBackground: '' }
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Prefs> }
    } catch {
        return defaults
    }
}

export const prefs = reactive<Prefs>(load())

watch(prefs, v => {
    try {
        localStorage.setItem(KEY, JSON.stringify(v))
    } catch { }
}, { deep: true })

/** paint the accent color into the CSS variables Quasar's primary color reads */
export function applyAccent(accent: Accent = prefs.accent) {
    const a = accents[accent] || accents.mint
    const root = document.documentElement.style
    root.setProperty('--q-primary', a.color)
    root.setProperty('--bv-accent-soft', a.soft)
}

/** text size and contrast: the whole app scales, and high contrast lifts the quiet greys */
export function applyDisplay() {
    const root = document.documentElement
    root.style.setProperty('--bv-text-scale', String(prefs.textScale || 1))
    const systemMore = window.matchMedia?.('(prefers-contrast: more)').matches
    document.body.classList.toggle('bv-contrast', prefs.highContrast || !!systemMore)
}

watch(() => [prefs.textScale, prefs.highContrast], () => applyDisplay())

/** a short vibration on devices that have one, for confirmations */
export function haptic(kind: 'tap' | 'success' | 'warning' = 'tap') {
    if (!prefs.haptics || typeof navigator.vibrate !== 'function') {
        return
    }
    try {
        navigator.vibrate(kind === 'success' ? [12, 60, 18] : kind === 'warning' ? [30, 40, 30] : 10)
    } catch { }
}

/** money, or dots while balances are hidden */
export function money(value: number, currency = prefs.currency, opts: { compact?: boolean } = {}): string {
    if (prefs.hideBalances) {
        return '••••'
    }
    // fractions of a cent (small tokens): three significant digits
    if (value !== 0 && Math.abs(value) < 0.01) {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumSignificantDigits: 3 }).format(value)
    }
    const digits = Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 1 ? 2 : 4
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: digits,
        minimumFractionDigits: digits === 4 ? 2 : digits,
        ...(opts.compact ? { notation: 'compact' } : {})
    }).format(value)
}
