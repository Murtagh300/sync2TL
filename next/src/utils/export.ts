/**
 * The activity as a file: CSV for spreadsheets and accounting, or a printable page (PDF
 * through the browser's print dialog).
 */

export type ExportRow = {
    time: number
    type: string
    title: string
    amount: string
    counterparty: string
    txId: string
    note: string
    /** what it was worth when it happened, in the chosen currency ('' when unknown) */
    value: string
}

const csvCell = (v: string) => /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v

export function toCsv(rows: ExportRow[], headers: string[]): string {
    const lines = [headers, ...rows.map(r => [
        new Date(r.time).toISOString(), r.type, r.title, r.amount, r.counterparty, r.txId, r.note, r.value
    ])]
    return lines.map(l => l.map(c => csvCell(String(c ?? ''))).join(',')).join('\n')
}

export function downloadText(name: string, text: string, type = 'text/csv') {
    // a BOM so spreadsheet apps read the accents right
    const blob = new Blob(['﻿' + text], { type: `${type};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** a plain page with the table, opened to print or save as PDF */
export function printTable(title: string, rows: ExportRow[], headers: string[]) {
    const w = window.open('', '_blank')
    if (!w) {
        return false
    }
    const body = rows.map(r => `<tr>${[
        new Date(r.time).toLocaleString(), r.type, r.title, r.amount, r.counterparty ? `${r.counterparty.slice(0, 8)}…${r.counterparty.slice(-6)}` : '', r.note, r.value
    ].map(c => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font:12px system-ui,sans-serif;margin:24px;color:#111}
h1{font-size:18px;margin:0 0 4px}
p{color:#555;margin:0 0 16px}
table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f4f4f4}
</style></head><body>
<h1>${esc(title)}</h1><p>${esc(new Date().toLocaleString())}</p>
<table><thead><tr>${[headers[0], headers[1], headers[2], headers[3], headers[4], headers[6], headers[7]].map(h => `<th>${esc(h!)}</th>`).join('')}</tr></thead>
<tbody>${body}</tbody></table>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`)
    w.document.close()
    return true
}
