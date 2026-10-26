import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

/**
 * One way to talk to the outside world, for every API the wallet reads:
 * - a time-out on every request;
 * - reads (GET) are retried on a network error, a 5xx or a 429, with growing pauses (and
 *   Retry-After when the server names one); writes are never retried;
 * - identical reads in flight are made once;
 * - a circuit breaker per host: after repeated failures the wallet stops asking for a while
 *   and fails at once, instead of piling up requests to a service that is down.
 */

type Breaker = { failures: number, openUntil: number, probing: boolean }

const breakers = new Map<string, Breaker>()
const THRESHOLD = 5
const OPEN_MS = 30 * 1000

export class CircuitOpenError extends Error {
    constructor(host: string) {
        super(`${host} is not answering; trying again shortly`)
        this.name = 'CircuitOpenError'
    }
}

function hostOf(config: AxiosRequestConfig): string {
    try {
        return new URL(axios.getUri(config), typeof location !== 'undefined' ? location.href : 'http://localhost').host
    } catch {
        return 'unknown'
    }
}

/** may this host be asked now? an open breaker lets one probe through after its pause */
export function breakerAllows(host: string, now = Date.now()): boolean {
    const b = breakers.get(host)
    if (!b || b.failures < THRESHOLD) return true
    if (now < b.openUntil) return false
    if (b.probing) return false
    b.probing = true
    return true
}

export function breakerResult(host: string, ok: boolean, now = Date.now()) {
    const b = breakers.get(host) || { failures: 0, openUntil: 0, probing: false }
    b.probing = false
    if (ok) {
        b.failures = 0
        b.openUntil = 0
    } else {
        b.failures++
        if (b.failures >= THRESHOLD) b.openUntil = now + OPEN_MS
    }
    breakers.set(host, b)
}

/** for tests */
export function resetBreakers() {
    breakers.clear()
}

const retryable = (err: AxiosError) => !err.response || err.response.status >= 500 || err.response.status === 429

/** the pause before retry n (0-based): 400 ms, 800 ms … with jitter, or what Retry-After says */
export function retryDelay(n: number, retryAfter?: string | null): number {
    const seconds = Number(retryAfter)
    if (retryAfter && Number.isFinite(seconds)) return Math.min(10000, seconds * 1000)
    return Math.min(5000, 400 * 2 ** n) * (0.75 + Math.random() * 0.5)
}

type Meta = { __retries?: number, __host?: string }

export function createClient(config: AxiosRequestConfig & { retries?: number } = {}): AxiosInstance {
    const { retries = 2, ...rest } = config
    const client = axios.create({ timeout: 20 * 1000, ...rest })

    client.interceptors.request.use((req: InternalAxiosRequestConfig & Meta) => {
        const host = hostOf(req)
        req.__host = host
        if (!breakerAllows(host)) {
            throw new CircuitOpenError(host)
        }
        return req
    })
    client.interceptors.response.use(
        resp => {
            breakerResult((resp.config as Meta).__host || hostOf(resp.config), true)
            return resp
        },
        async (err: AxiosError) => {
            if (err instanceof CircuitOpenError || !err.config) throw err
            const cfg = err.config as InternalAxiosRequestConfig & Meta
            const host = cfg.__host || hostOf(cfg)
            // a 4xx is an answer: the service is up
            breakerResult(host, !retryable(err))
            const n = cfg.__retries || 0
            if ((cfg.method || 'get').toLowerCase() === 'get' && retryable(err) && n < retries && !axios.isCancel(err)) {
                cfg.__retries = n + 1
                await new Promise(r => setTimeout(r, retryDelay(n, err.response?.headers?.['retry-after'] as string | undefined)))
                return client.request(cfg)
            }
            throw err
        }
    )

    // identical reads in flight share one request
    const inflight = new Map<string, Promise<unknown>>()
    const get = client.get.bind(client)
    client.get = ((url: string, cfg?: AxiosRequestConfig) => {
        const key = axios.getUri({ baseURL: client.defaults.baseURL, url, params: cfg?.params })
        const running = inflight.get(key)
        if (running) return running
        const p = get(url, cfg).finally(() => inflight.delete(key))
        inflight.set(key, p)
        return p
    }) as AxiosInstance['get']

    return client
}
