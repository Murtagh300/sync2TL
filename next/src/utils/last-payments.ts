/** the last payment to each address, kept on this device: "last paid 25 VET, 3 days ago" */
export type LastPayment = { amount: string, symbol: string, time: number }

const KEY = 'bv-last-payments'

function read(): Record<string, LastPayment> {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, LastPayment>
    } catch {
        return {}
    }
}

export function rememberPayment(address: string, amount: string, symbol: string, time = Date.now()) {
    const all = read()
    all[address.toLowerCase()] = { amount, symbol, time }
    // the 200 most recent
    const kept = Object.entries(all).sort((a, b) => b[1].time - a[1].time).slice(0, 200)
    try {
        localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)))
    } catch { }
}

export function lastPayment(address: string): LastPayment | null {
    return read()[address.toLowerCase()] || null
}

/** groups suggested when a contact has none yet; any other name can be typed */
export const SUGGESTED_GROUPS = ['family', 'friends', 'team', 'exchange', 'business']

/** the latest payments, newest first: "send again" on the home screen */
export function recentPayments(n = 3, except: string[] = []): (LastPayment & { address: string })[] {
    const skip = new Set(except.map(a => a.toLowerCase()))
    return Object.entries(read())
        .filter(([a]) => !skip.has(a))
        .sort((a, b) => b[1].time - a[1].time)
        .slice(0, n)
        .map(([address, p]) => ({ address, ...p }))
}
