import type { Flow } from './overview'

/**
 * A monthly statement, as a bank sends one: per token what came in and went out, the fees,
 * the balance at the start and end of the month, and every transaction. Read from the chain, so
 * it covers the addresses whatever wallet they were used in. Balances are worked back from
 * today's: today's balance, less what moved since the month ended (and VTHO fees paid since).
 */

export const VTHO = '0x0000000000000000000000000000456e65726779'

/** the first and last moment of a month (local time), in ms */
export function monthRange(year: number, month: number): [number, number] {
    return [new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime() - 1]
}

/** what flowed per token (net of moves between the addresses themselves) */
export function netByToken(list: Flow[], own: string[]): Map<string, { in: bigint, out: bigint }> {
    const mine = new Set(own.map(a => a.toLowerCase()))
    const out = new Map<string, { in: bigint, out: bigint }>()
    for (const f of list) {
        if (mine.has(f.counterparty.toLowerCase())) continue
        const t = out.get(f.token) || { in: 0n, out: 0n }
        if (f.dir === 'in') t.in += f.amount
        else t.out += f.amount
        out.set(f.token, t)
    }
    return out
}

export type StatementLine = { token: string, start: bigint, in: bigint, out: bigint, fees: bigint, end: bigint }

/**
 * the statement's lines: `now` the balances today, `inMonth` and `after` the flows in the month
 * and since it ended, `feesIn` and `feesAfter` the VTHO fees paid in those times
 */
export function statementLines(
    tokens: string[],
    now: Map<string, bigint>,
    inMonth: Map<string, { in: bigint, out: bigint }>,
    after: Map<string, { in: bigint, out: bigint }>,
    feesIn: bigint,
    feesAfter: bigint
): StatementLine[] {
    return tokens.map(token => {
        const a = after.get(token) || { in: 0n, out: 0n }
        const m = inMonth.get(token) || { in: 0n, out: 0n }
        const isVtho = token === VTHO
        const end = (now.get(token) || 0n) - a.in + a.out + (isVtho ? feesAfter : 0n)
        const fees = isVtho ? feesIn : 0n
        const start = end - m.in + m.out + fees
        return { token, start, in: m.in, out: m.out, fees, end }
    }).filter(l => l.start !== 0n || l.end !== 0n || l.in !== 0n || l.out !== 0n || l.fees !== 0n)
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export type StatementLabels = { title: string, period: string, addresses: string, token: string, start: string, in: string, out: string, fees: string, end: string, transactions: string, date: string, amount: string, with: string, none: string, footer: string }

/** the statement as a page to print or save as PDF; every value goes in as text */
export function statementHtml(
    l: StatementLabels,
    lines: { symbol: string, start: string, in: string, out: string, fees: string, end: string }[],
    txs: { date: string, amount: string, with: string }[],
    addresses: string[],
    lang: string
): string {
    const sum = lines.map(x => `<tr><td>${esc(x.symbol)}</td><td class="n">${esc(x.start)}</td><td class="n">${esc(x.in)}</td><td class="n">${esc(x.out)}</td><td class="n">${esc(x.fees)}</td><td class="n b">${esc(x.end)}</td></tr>`).join('')
    const rows = txs.map(x => `<tr><td>${esc(x.date)}</td><td class="n">${esc(x.amount)}</td><td class="w">${esc(x.with)}</td></tr>`).join('')
    return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(l.title)}</title>
<style>
@page { margin: 16mm }
body { font: 12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; margin: 0 }
.brand { font-weight: 800; font-size: 12px; color: #555 }
h1 { font-size: 22px; margin: 4px 0 2px }
.meta { color: #555; margin-bottom: 16px; word-break: break-all }
h2 { font-size: 13px; margin: 20px 0 6px }
table { border-collapse: collapse; width: 100% }
th { text-align: left; font-size: 10px; color: #777; border-bottom: 1px solid #bbb; padding: 5px 0 }
td { border-bottom: 1px solid #e6e6e6; padding: 5px 0; vertical-align: top }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; padding-left: 10px }
.b { font-weight: 800 }
.w { word-break: break-all; padding-left: 12px; color: #444 }
footer { margin-top: 22px; font-size: 10px; color: #777 }
</style></head><body>
<div class="brand">BlackVault</div>
<h1>${esc(l.title)}</h1>
<div class="meta">${esc(l.period)}<br>${esc(l.addresses)}: ${addresses.map(esc).join(', ')}</div>
<table><thead><tr><th>${esc(l.token)}</th><th class="n">${esc(l.start)}</th><th class="n">${esc(l.in)}</th><th class="n">${esc(l.out)}</th><th class="n">${esc(l.fees)}</th><th class="n">${esc(l.end)}</th></tr></thead><tbody>${sum}</tbody></table>
<h2>${esc(l.transactions)}</h2>
${rows ? `<table><thead><tr><th>${esc(l.date)}</th><th class="n">${esc(l.amount)}</th><th class="w">${esc(l.with)}</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>${esc(l.none)}</p>`}
<footer>${esc(l.footer)}</footer>
</body></html>`
}
