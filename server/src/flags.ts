import { readFile } from 'node:fs/promises'

/**
 * Remote config: switches the wallet reads at start. It can only turn features off and show a
 * notice; it can never change where funds go, add a contract or touch keys. The file is read
 * again when it changes (checked every 30 seconds), so a feature can be paused without a release.
 */

export const FEATURES = ['walletconnect', 'swap', 'payout', 'dust', 'consolidate', 'stargate', 'vebetter', 'launchpad', 'push'] as const
export type Feature = typeof FEATURES[number]

export type Flags = {
    version: number
    features: Record<Feature, boolean>
    /** a message on top of the app, per language (en is the fallback) */
    notice: { level: 'info' | 'warning'; text: Record<string, string> } | null
    /** the lowest app version that is still fine to use; older ones are asked to update */
    minVersion: string
}

export const DEFAULT_FLAGS: Flags = {
    version: 1,
    features: Object.fromEntries(FEATURES.map(f => [f, true])) as Record<Feature, boolean>,
    notice: null,
    minVersion: '0.0.0'
}

/** a flags file made safe: unknown keys dropped, wrong types back to the defaults */
export function sanitizeFlags(raw: unknown): Flags {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const features = { ...DEFAULT_FLAGS.features }
    const rf = (r.features && typeof r.features === 'object' ? r.features : {}) as Record<string, unknown>
    for (const f of FEATURES) {
        if (typeof rf[f] === 'boolean') features[f] = rf[f] as boolean
    }
    let notice: Flags['notice'] = null
    const rn = r.notice as Record<string, unknown> | null | undefined
    if (rn && typeof rn === 'object' && rn.text && typeof rn.text === 'object') {
        const text: Record<string, string> = {}
        for (const [lang, t] of Object.entries(rn.text as Record<string, unknown>)) {
            if (typeof t === 'string' && /^[a-z]{2}(-[a-z]{2})?$/.test(lang)) text[lang] = t.slice(0, 280)
        }
        if (Object.keys(text).length) notice = { level: rn.level === 'warning' ? 'warning' : 'info', text }
    }
    return {
        version: typeof r.version === 'number' ? r.version : DEFAULT_FLAGS.version,
        features,
        notice,
        minVersion: typeof r.minVersion === 'string' && /^\d+\.\d+\.\d+$/.test(r.minVersion) ? r.minVersion : DEFAULT_FLAGS.minVersion
    }
}

export function createFlags(file: string) {
    let current: Flags = DEFAULT_FLAGS
    let lastText = ''
    const reload = async () => {
        try {
            const text = await readFile(file, 'utf8')
            if (text === lastText) return
            lastText = text
            current = sanitizeFlags(JSON.parse(text))
            console.log(`[flags] loaded version ${current.version}`)
        } catch (err) {
            // no file or bad JSON: keep what we had (the defaults at first)
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[flags] not loaded:', (err as Error).message)
        }
    }
    void reload()
    const timer = setInterval(() => void reload(), 30000)
    timer.unref()
    return () => current
}
