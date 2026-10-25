/**
 * The last values the app saw (balances, portfolio, NFT pages), kept in localStorage so
 * screens open with them at once and refresh in the background. Also what the app shows
 * offline.
 */

const PREFIX = 'bv-snap:'
// a cap so the snapshot never grows without end
const MAX_KEYS = 400

type Entry<T> = { at: number, value: T }

export function readSnapshot<T>(key: string): Entry<T> | null {
    try {
        const raw = localStorage.getItem(PREFIX + key)
        return raw ? JSON.parse(raw) as Entry<T> : null
    } catch {
        return null
    }
}

export function writeSnapshot<T>(key: string, value: T) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }))
    } catch {
        // storage full: drop the oldest snapshots and carry on
        pruneSnapshots(MAX_KEYS / 2)
    }
}

function pruneSnapshots(keep: number) {
    try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX))
        if (keys.length <= keep) {
            return
        }
        const aged = keys.map(k => ({ k, at: (JSON.parse(localStorage.getItem(k) || '{}') as { at?: number }).at || 0 }))
            .sort((a, b) => a.at - b.at)
        aged.slice(0, aged.length - keep).forEach(e => localStorage.removeItem(e.k))
    } catch { }
}

export const balanceKey = (gid: string, address: string, symbol: string) =>
    `bal:${gid.slice(-6)}:${address.toLowerCase()}:${symbol}`
