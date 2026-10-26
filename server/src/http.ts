import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * A small router and the response helpers every route uses: JSON, errors, CORS for the
 * wallet's origins only, security headers, and request bodies with a size cap.
 */

export type Ctx = {
    req: IncomingMessage
    res: ServerResponse
    url: URL
    params: Record<string, string>
    ip: string
}

export type Handler = (ctx: Ctx) => Promise<void> | void

type Route = { method: string, pattern: RegExp, keys: string[], handler: Handler }

export class HttpError extends Error {
    status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

export function createRouter() {
    const routes: Route[] = []
    const add = (method: string, path: string, handler: Handler) => {
        const keys: string[] = []
        // "/api/bvm/*" and "/push/:id"
        const pattern = new RegExp('^' + path
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\/\*$/, '/(?<rest>.*)')
            .replace(/:(\w+)/g, (_, k: string) => { keys.push(k); return `(?<${k}>[^/]+)` }) + '$')
        routes.push({ method, pattern, keys, handler })
    }
    return {
        get: (path: string, h: Handler) => add('GET', path, h),
        post: (path: string, h: Handler) => add('POST', path, h),
        delete: (path: string, h: Handler) => add('DELETE', path, h),
        match(method: string, pathname: string): { handler: Handler, params: Record<string, string> } | null {
            for (const r of routes) {
                if (r.method !== method) continue
                const m = r.pattern.exec(pathname)
                if (m) return { handler: r.handler, params: { ...(m.groups || {}) } }
            }
            return null
        },
        /** whether some method serves this path (for 405 rather than 404) */
        knows(pathname: string) {
            return routes.some(r => r.pattern.test(pathname))
        }
    }
}

export function securityHeaders(res: ServerResponse) {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
}

/** CORS for the wallet's origins; returns false for a preflight that has been answered */
export function cors(req: IncomingMessage, res: ServerResponse, allowed: string[]): boolean {
    const origin = req.headers.origin || ''
    if (origin && allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'content-type')
        res.setHeader('Access-Control-Max-Age', '600')
    }
    if (req.method === 'OPTIONS') {
        res.statusCode = origin && allowed.includes(origin) ? 204 : 403
        res.end()
        return false
    }
    return true
}

export function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
    const text = JSON.stringify(body)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
    res.end(text)
}

/** the request body as JSON, at most `limit` bytes */
export async function readJson<T>(req: IncomingMessage, limit = 16 * 1024): Promise<T> {
    if (!/application\/json/.test(req.headers['content-type'] || '')) {
        throw new HttpError(415, 'expected application/json')
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
        size += (chunk as Buffer).length
        if (size > limit) throw new HttpError(413, 'body too large')
        chunks.push(chunk as Buffer)
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
    } catch {
        throw new HttpError(400, 'invalid JSON')
    }
}

/** the client's address: the socket's, or the first X-Forwarded-For hop behind our own proxy */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
    if (trustProxy) {
        const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0]!.trim()
        if (xff) return xff
    }
    return req.socket.remoteAddress || 'unknown'
}
