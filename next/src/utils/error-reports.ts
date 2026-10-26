import { createClient } from './net'
import { serverUrl } from './endpoints'
import { prefs } from './prefs'

/**
 * Error reports, only when the user turned them on (Settings › Send error reports).
 * A report is the error's message and stack, the page's name (not its path: that can hold an
 * address), the version and the browser. Addresses, transaction ids, keys, recovery words,
 * amounts and URLs with queries are removed here, and again by the server (server/src/scrub.ts).
 */

// twelve or more short lowercase words in a row look like a recovery phrase
// (whole words only: the scheme of a URL right after them is not one)
const WORD_RUN = /(?<![\w:/.-])(?:[a-z]{3,8}\s+){11,}[a-z]{3,8}(?![\w:/.-])/g

/** the same rules as the server's (server/src/scrub.ts) */
export function scrub(text: string, max = 2000): string {
    return text
        // URLs first, so their queries go before anything inside them is rewritten
        .replace(/https?:\/\/[^\s'")]+/g, u => {
            try {
                const url = new URL(u)
                return `${url.origin}${url.pathname.replace(/\/0x[0-9a-fA-F]+/g, '/[hex]')}`
            } catch {
                return '[url]'
            }
        })
        .replace(WORD_RUN, '[words]')
        .replace(/0x[0-9a-fA-F]{40,}/g, '[hex]')
        .replace(/\b[0-9a-fA-F]{32,}\b/g, '[hex]')
        .replace(/\b\w+\.vet\b/gi, '[name]')
        .replace(/\b\d+[.,]\d+\b/g, '[n]')
        .replace(/\b\d{6,}\b/g, '[n]')
        .slice(0, max)
}

export type Report = { message: string, stack: string, route: string, version: string, ua: string }

export function buildReport(err: unknown, route: string): Report {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'unknown error')
    return {
        message: scrub(e.message || e.name, 500),
        stack: scrub(e.stack || '', 4000),
        route: /^[a-z0-9-]{1,40}$/.test(route) ? route : '',
        version: String(import.meta.env.APP_VERSION || ''),
        ua: navigator.userAgent.slice(0, 200)
    }
}

const http = serverUrl === null ? null : createClient({ baseURL: serverUrl, timeout: 8000, retries: 0 })
const sent = new Map<string, number>()
let lastMinute = { at: 0, n: 0 }

/** send one report, at most five a minute and the same error once an hour */
export function reportError(err: unknown, route = '') {
    if (!http || !prefs.errorReports) return
    // a user dismissing a dialog or a request being cancelled is not an error
    if (err === undefined || err === null || (err instanceof Error && /cancel|abort/i.test(err.name + err.message))) return
    const report = buildReport(err, route)
    const now = Date.now()
    const key = `${report.message}|${report.stack.split('\n')[1] || ''}`
    if ((sent.get(key) || 0) > now - 60 * 60 * 1000) return
    if (now - lastMinute.at > 60 * 1000) lastMinute = { at: now, n: 0 }
    if (++lastMinute.n > 5) return
    sent.set(key, now)
    http.post('/errors', report).catch(() => { })
}

/** catch what nobody else catches: Vue's errors, uncaught errors and unhandled rejections */
export function installErrorReports(app: { config: { errorHandler?: unknown } }, routeName: () => string) {
    if (!http) return
    const previous = app.config.errorHandler as ((...args: unknown[]) => void) | undefined
    app.config.errorHandler = (err: unknown, ...rest: unknown[]) => {
        reportError(err, routeName())
        if (previous) previous(err, ...rest)
        else console.error(err)
    }
    window.addEventListener('error', ev => reportError(ev.error || ev.message, routeName()))
    window.addEventListener('unhandledrejection', ev => reportError(ev.reason, routeName()))
}
