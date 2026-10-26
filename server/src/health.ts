/**
 * What the wallet depends on, checked at most every 30 seconds: the mainnet nodes,
 * BlackVeMarket, BetterSwap and WalletConnect's relay. GET /health is JSON for the app and
 * for monitoring; GET /status is the same as a page for people.
 */

export type Check = { name: string, ok: boolean, ms: number, detail?: string }
export type Health = { ok: boolean, at: string, checks: Check[] }

type Probe = { name: string, url: string, method?: 'GET' | 'HEAD', expectJson?: boolean }

async function probe(p: Probe): Promise<Check> {
    const started = performance.now()
    try {
        const resp = await fetch(p.url, { method: p.method || 'GET', signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } })
        const ms = Math.round(performance.now() - started)
        if (!resp.ok) return { name: p.name, ok: false, ms, detail: `HTTP ${resp.status}` }
        if (p.expectJson) await resp.json()
        else await resp.arrayBuffer()
        return { name: p.name, ok: true, ms }
    } catch (err) {
        return { name: p.name, ok: false, ms: Math.round(performance.now() - started), detail: err instanceof Error ? err.message : 'failed' }
    }
}

export function createHealth(opts: { nodes: string[], bvmUrl: string, betterswapUrl: string }) {
    let last: { at: number, value: Promise<Health> } | null = null
    const probes: Probe[] = [
        ...opts.nodes.map((n, i) => ({ name: `node ${i + 1} (${new URL(n).host})`, url: `${n.replace(/\/$/, '')}/blocks/best`, expectJson: true })),
        { name: 'BlackVeMarket', url: `${opts.bvmUrl}/rates`, expectJson: true },
        { name: 'BetterSwap', url: `${opts.betterswapUrl}/tokens`, expectJson: true },
        // the relay answers a plain GET with a small status page
        { name: 'WalletConnect relay', url: 'https://relay.walletconnect.org/health' }
    ]
    return function health(): Promise<Health> {
        if (last && Date.now() - last.at < 30000) return last.value
        const value = Promise.all(probes.map(probe)).then(checks => {
            // the wallet works when one node answers; the rest only limits features
            const anyNode = checks.filter(c => c.name.startsWith('node ')).some(c => c.ok)
            return { ok: anyNode, at: new Date().toISOString(), checks }
        })
        last = { at: Date.now(), value }
        return value
    }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** a plain status page; no scripts, so the strict CSP holds */
export function statusPage(h: Health): string {
    const rows = h.checks.map(c => `<tr><td>${esc(c.name)}</td><td class="${c.ok ? 'ok' : 'bad'}">${c.ok ? 'OK' : 'Down'}</td><td>${c.ms} ms</td><td>${esc(c.detail || '')}</td></tr>`).join('')
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60"><title>BlackVault status</title>
<style>body{font:15px system-ui,sans-serif;background:#080a09;color:#e4e4e7;max-width:720px;margin:40px auto;padding:0 16px}
h1{font-size:22px}table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #27272a}
.ok{color:#6ee7b7;font-weight:700}.bad{color:#f87171;font-weight:700}p{color:#a1a1aa}</style></head>
<body><h1>BlackVault status: ${h.ok ? 'operational' : 'degraded'}</h1><p>Checked ${esc(h.at)} · refreshes every minute</p>
<table>${rows}</table></body></html>`
}
