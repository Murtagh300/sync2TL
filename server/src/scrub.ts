/**
 * Error reports carry no personal data: addresses, transaction ids, keys, recovery words,
 * amounts and URLs with queries are removed before a report is stored. The wallet scrubs
 * before sending (src/utils/error-reports.ts) and the server scrubs again.
 */

// BIP-39 words are lowercase a-z; twelve or more in a row look like a recovery phrase
// (whole words only: the scheme of a URL right after them is not one)
const WORD_RUN = /(?<![\w:/.-])(?:[a-z]{3,8}\s+){11,}[a-z]{3,8}(?![\w:/.-])/g

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

/** a report from a client, cut to size and scrubbed; null when it isn't one */
export function cleanReport(raw: unknown): Report | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const str = (v: unknown, n: number) => (typeof v === 'string' ? scrub(v, n) : '')
    const report = {
        message: str(r.message, 500),
        stack: str(r.stack, 4000),
        // a route name, not the URL: no addresses in it
        route: typeof r.route === 'string' && /^[a-z0-9-]{0,40}$/.test(r.route) ? r.route : '',
        version: typeof r.version === 'string' && /^[\w.+-]{1,40}$/.test(r.version) ? r.version : '',
        ua: str(r.ua, 200)
    }
    return report.message ? report : null
}
