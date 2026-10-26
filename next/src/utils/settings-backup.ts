/**
 * A backup of the wallet's settings, for a new device or a fresh install: contacts, notes, the
 * watchlist, price alerts, hidden NFTs, scheduled payments, the emergency plan and preferences.
 * Never keys, recovery words or wallets: those are restored with the recovery words. Never the
 * nodes either: a file from someone else could otherwise point the wallet at their node.
 *
 * The file is encrypted with a password (PBKDF2-SHA256, 600,000 rounds → AES-256-GCM), because
 * contacts and notes say a lot about a person. Only the keys listed here are written back.
 */

/** settings in localStorage */
export const LOCAL_KEYS = [
    'bv-prefs', 'bv-home-widgets', 'bv-payments', 'bv-tx-notes', 'bv-emergency', 'bv-last-payments',
    'bv-launch-reminders', 'bv-swap-pairs', 'bv-fav-dapps', 'bv-wc-project'
] as const

/** settings in the config store (boot/services/config) */
export const CONFIG_KEYS = [
    'contacts', 'watchlist', 'alerts', 'token-prefs', 'hidden-nfts', 'nft-notes', 'activeTokenSymbols', 'language'
] as const

export type ConfigKey = typeof CONFIG_KEYS[number]

export type Settings = { local: Record<string, string>, config: Record<string, string> }

export type BackupFile = {
    format: 'blackvault-settings'
    version: 1
    created: string
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: number, salt: string }
    cipher: { name: 'AES-GCM', iv: string }
    data: string
}

const ITERATIONS = 600000

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0))

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** only the listed keys, only strings */
export function pickSettings(raw: unknown): Settings {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const pick = (src: unknown, keys: readonly string[]) => {
        const o = (src && typeof src === 'object' ? src : {}) as Record<string, unknown>
        const out: Record<string, string> = {}
        for (const k of keys) {
            if (typeof o[k] === 'string' && (o[k] as string).length <= 2_000_000) out[k] = o[k] as string
        }
        return out
    }
    const out = { local: pick(r.local, LOCAL_KEYS), config: pick(r.config, CONFIG_KEYS) }
    // sending error reports is a choice made on this device, never one a file makes
    if (out.local['bv-prefs']) {
        try {
            const prefs = JSON.parse(out.local['bv-prefs']) as Record<string, unknown>
            if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
                prefs.errorReports = false
                out.local['bv-prefs'] = JSON.stringify(prefs)
            } else {
                delete out.local['bv-prefs']
            }
        } catch {
            delete out.local['bv-prefs']
        }
    }
    return out
}

export async function encryptSettings(settings: Settings, password: string, iterations = ITERATIONS): Promise<BackupFile> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(password, salt, iterations)
    const plain = new TextEncoder().encode(JSON.stringify(pickSettings(settings)))
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
    return {
        format: 'blackvault-settings',
        version: 1,
        created: new Date().toISOString(),
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: b64(salt) },
        cipher: { name: 'AES-GCM', iv: b64(iv) },
        data: b64(data)
    }
}

export class BackupError extends Error {
    constructor(readonly reason: 'format' | 'password') {
        super(reason)
        this.name = 'BackupError'
    }
}

export async function decryptSettings(text: string, password: string): Promise<Settings> {
    let file: BackupFile
    try {
        file = JSON.parse(text) as BackupFile
    } catch {
        throw new BackupError('format')
    }
    if (file?.format !== 'blackvault-settings' || file.version !== 1 || !file.kdf || !file.cipher || typeof file.data !== 'string' ||
        !(file.kdf.iterations >= 100000 && file.kdf.iterations <= 10_000_000)) {
        throw new BackupError('format')
    }
    const key = await deriveKey(password, unb64(file.kdf.salt), file.kdf.iterations)
    let plain: ArrayBuffer
    try {
        plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.cipher.iv) }, key, unb64(file.data))
    } catch {
        // GCM checks the tag: a wrong password (or a changed file) fails here
        throw new BackupError('password')
    }
    try {
        return pickSettings(JSON.parse(new TextDecoder().decode(plain)))
    } catch {
        throw new BackupError('format')
    }
}

/** how many things a backup holds, to show before restoring */
export function summarize(s: Settings): { contacts: number, notes: number, settings: number, names: string } {
    const count = (raw: string | undefined) => {
        try {
            const v = JSON.parse(raw || '[]') as unknown
            return Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0
        } catch {
            return 0
        }
    }
    // the contacts by name, so a file that renames addresses is noticed before it is restored
    let names = ''
    try {
        const list = JSON.parse(s.config.contacts || '[]') as { name?: unknown }[]
        if (Array.isArray(list)) {
            const all = list.map(c => (typeof c?.name === 'string' ? c.name.slice(0, 40) : '')).filter(Boolean)
            names = all.slice(0, 8).join(', ') + (all.length > 8 ? `, +${all.length - 8}` : '')
        }
    } catch { }
    return {
        names,
        contacts: count(s.config.contacts),
        notes: count(s.local['bv-tx-notes']) + count(s.config['nft-notes']),
        settings: Object.keys(s.local).length + Object.keys(s.config).length
    }
}
