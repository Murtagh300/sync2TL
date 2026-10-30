import { reactive, watch } from 'vue'

/** the blocks of the home screen, in the user's order; each can be switched off */
export type WidgetKey = 'ticker' | 'portfolio' | 'actions' | 'resend' | 'tokens' | 'watchlist' | 'launchpad' | 'addresses'
export type Widget = { key: WidgetKey, on: boolean }

// a calm home by default: the ticker, the total value, the top tokens and the address cards;
// the rest is the user's choice
const KEY = 'bv-home-widgets-3'
const DEFAULTS: Widget[] = [
    { key: 'ticker', on: true },
    { key: 'portfolio', on: true },
    { key: 'actions', on: false },
    { key: 'resend', on: false },
    { key: 'tokens', on: true },
    { key: 'watchlist', on: false },
    { key: 'launchpad', on: false },
    { key: 'addresses', on: true }
]

/** 2.4.1 switched the ticker and the address cards off for everyone: back on (the ticker on top), the rest as it was */
function fromPrevious(): Widget[] {
    const saved = JSON.parse(localStorage.getItem('bv-home-widgets-2') || '[]') as Widget[]
    if (!saved.length) {
        return []
    }
    const rest = saved.filter(w => w.key !== 'ticker').map(w => (w.key === 'addresses' ? { ...w, on: true } : w))
    return [{ key: 'ticker', on: true }, ...rest]
}

function load(): Widget[] {
    try {
        const current = localStorage.getItem(KEY)
        const saved = current ? JSON.parse(current) as Widget[] : fromPrevious()
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
