import { reactive, watch } from 'vue'

/** the blocks of the home screen, in the user's order; each can be switched off */
export type WidgetKey = 'ticker' | 'portfolio' | 'actions' | 'resend' | 'tokens' | 'watchlist' | 'launchpad' | 'addresses'
export type Widget = { key: WidgetKey, on: boolean }

// a calm home by default: the total value and the top tokens; the rest is the user's choice
// (a new key: everyone starts from these defaults once)
const KEY = 'bv-home-widgets-2'
const DEFAULTS: Widget[] = [
    { key: 'portfolio', on: true },
    { key: 'tokens', on: true },
    { key: 'actions', on: false },
    { key: 'resend', on: false },
    { key: 'ticker', on: false },
    { key: 'watchlist', on: false },
    { key: 'launchpad', on: false },
    { key: 'addresses', on: false }
]

function load(): Widget[] {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || '[]') as Widget[]
        // keep the saved order; widgets that came later go where they are by default
        const list = saved.filter(w => DEFAULTS.some(d => d.key === w.key))
        DEFAULTS.forEach((d, i) => {
            if (!list.some(w => w.key === d.key)) list.splice(Math.min(i, list.length), 0, { ...d })
        })
        return list
    } catch {
        return DEFAULTS.map(d => ({ ...d }))
    }
}

export const homeWidgets = reactive<{ list: Widget[] }>({ list: load() })

watch(() => homeWidgets.list, list => {
    try {
        localStorage.setItem(KEY, JSON.stringify(list))
    } catch { }
}, { deep: true })

export function resetWidgets() {
    homeWidgets.list = DEFAULTS.map(d => ({ ...d }))
}
