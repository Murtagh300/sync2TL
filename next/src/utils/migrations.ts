/**
 * What BlackVault keeps in localStorage changes shape over time. Each change is a migration
 * here, run once per device in order, before anything reads its settings (the first import of
 * App.vue). The version reached is kept in 'bv-schema'.
 *
 * A migration never deletes what it can't read: a value that is broken is kept next to it as
 * '<key>.corrupt', so nothing a user saved is lost without a trace.
 * (The wallets, keys and activity live in IndexedDB, which has its own versions: core/storage.)
 */

export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { readonly length: number, key(i: number): string | null }

const SCHEMA_KEY = 'bv-schema'

/** the localStorage keys that hold JSON */
export const JSON_KEYS = [
    'bv-prefs', 'bv-home-widgets', 'bv-payments', 'bv-notifications', 'bv-tx-notes', 'bv-emergency',
    'bv-last-payments', 'bv-launch-reminders', 'bv-swap-pairs', 'bv-wc-used', 'bv-fav-dapps',
    'bv-remote-config', 'bv-dismissed-notices'
]

function parses(raw: string) {
    try {
        JSON.parse(raw)
        return true
    } catch {
        return false
    }
}

export const migrations: { to: number, name: string, run(kv: KV): void }[] = [{
    to: 1,
    name: 'set broken JSON aside, so a damaged value can not stop the app from starting',
    run(kv) {
        for (const key of JSON_KEYS) {
            const raw = kv.getItem(key)
            if (raw !== null && !parses(raw)) {
                kv.setItem(`${key}.corrupt`, raw)
                kv.removeItem(key)
            }
        }
    }
}, {
    to: 2,
    name: 'prefs: drop settings that are no longer used, fill in the ones added since',
    run(kv) {
        const raw = kv.getItem('bv-prefs')
        if (!raw) return
        const prefs = JSON.parse(raw) as Record<string, unknown>
        if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
            kv.setItem('bv-prefs.corrupt', raw)
            kv.removeItem('bv-prefs')
            return
        }
        const known = ['hideBalances', 'currency', 'accent', 'haptics', 'autoLockMinutes', 'textScale', 'highContrast', 'homeBackground', 'shakeToHide', 'spendLimit', 'sound', 'errorReports']
        for (const k of Object.keys(prefs)) {
            if (!known.includes(k)) delete prefs[k]
        }
        // error reports are opt-in: never on by a migration
        prefs.errorReports = false
        kv.setItem('bv-prefs', JSON.stringify(prefs))
    }
}]

export const SCHEMA = migrations[migrations.length - 1]!.to

/** run what this device hasn't run yet; returns the names of the migrations that ran */
export function migrate(kv: KV): string[] {
    const from = parseInt(kv.getItem(SCHEMA_KEY) || '0', 10) || 0
    const ran: string[] = []
    for (const m of migrations) {
        if (m.to <= from) continue
        try {
            m.run(kv)
            ran.push(m.name)
        } catch (err) {
            // stop here and try again next start: a later migration may depend on this one
            console.warn(`migration ${m.to} failed:`, err)
            return ran
        }
        kv.setItem(SCHEMA_KEY, String(m.to))
    }
    return ran
}

/** a device on a newer schema than this app knows (an older version was opened again) */
export function fromTheFuture(kv: KV): boolean {
    return (parseInt(kv.getItem(SCHEMA_KEY) || '0', 10) || 0) > SCHEMA
}
