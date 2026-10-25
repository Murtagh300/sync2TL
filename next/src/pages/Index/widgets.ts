import { reactive, watch } from 'vue'

/** the blocks of the home screen, in the user's order; each can be switched off */
export type WidgetKey = 'portfolio' | 'actions' | 'tokens' | 'watchlist' | 'launchpad' | 'addresses'
export type Widget = { key: WidgetKey, on: boolean }

const KEY = 'bv-home-widgets'
const DEFAULTS: Widget[] = [
    { key: 'portfolio', on: true },
    { key: 'actions', on: true },
    { key: 'tokens', on: true },
    { key: 'watchlist', on: false },
    { key: 'launchpad', on: false },
    { key: 'addresses', on: true }
]

function load(): Widget[] {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || '[]') as Widget[]
        // keep the saved order; add widgets that came later
        const known = saved.filter(w => DEFAULTS.some(d => d.key === w.key))
        return [...known, ...DEFAULTS.filter(d => !known.some(w => w.key === d.key))]
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
