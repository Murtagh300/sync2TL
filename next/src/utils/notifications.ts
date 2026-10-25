import { computed, reactive, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * The notification center: what arrived, offers, price alerts and finished transactions,
 * kept on this device (the newest 100), read or unread.
 */

export type NotificationKind = 'in' | 'out' | 'offer' | 'alert' | 'tx-done' | 'tx-failed'

export type AppNotification = {
    id: string
    time: number
    kind: NotificationKind
    title: string
    body?: string
    route?: RouteLocationRaw
    read: boolean
}

const KEY = 'bv-notifications'
const MAX = 100

function load(): AppNotification[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]') as AppNotification[]
    } catch {
        return []
    }
}

export const notifications = reactive<{ list: AppNotification[] }>({ list: load() })

watch(() => notifications.list, list => {
    try {
        localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
    } catch { }
}, { deep: true })

export const unreadCount = computed(() => notifications.list.filter(n => !n.read).length)

// the unread count on the app icon, where the installed app supports it
type Badging = { setAppBadge?: (n?: number) => Promise<void>, clearAppBadge?: () => Promise<void> }
watch(unreadCount, n => {
    const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Badging
    if (n > 0) {
        nav.setAppBadge?.(n).catch(() => { })
    } else {
        nav.clearAppBadge?.().catch(() => { })
    }
}, { immediate: true })

/** add one; the same id twice is kept once */
export function notify(n: Omit<AppNotification, 'time' | 'read'> & { time?: number }) {
    if (notifications.list.some(x => x.id === n.id)) {
        return
    }
    notifications.list = [{ ...n, time: n.time ?? Date.now(), read: false }, ...notifications.list].slice(0, MAX)
}

export function markAllRead() {
    notifications.list = notifications.list.map(n => ({ ...n, read: true }))
}

export function clearNotifications() {
    notifications.list = []
}

/** a balance change, for the live "+50 VET" on the home screen */
export type BalancePulse = { walletId: number, addressIndex: number, dir: 'in' | 'out', text: string }

export function emitBalancePulse(p: BalancePulse) {
    window.dispatchEvent(new CustomEvent<BalancePulse>('bv:balance', { detail: p }))
}
