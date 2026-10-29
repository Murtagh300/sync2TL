import { reactive, watch } from 'vue'
import QRCode from 'qrcode-svg'
import type { Currency } from './fiat'
export { printPage } from './receipt'

/**
 * Invoices: lines, VAT, your details and the customer's, a number and a due date, printed or
 * saved as PDF, with a payment link and QR code. The amount in crypto is fixed when the invoice is
 * made (at that day's price, which the invoice states) and carries its own last digits, so the
 * payment is recognised like any payment request (utils/payments.ts): the invoice shows "paid".
 */

export type InvoiceLine = { text: string, qty: number, price: number }

export type Party = { name: string, details: string }

export type Invoice = {
    id: string
    number: string
    createdAt: number
    dueDays: number
    seller: Party & { vat: string }
    buyer: Party
    lines: InvoiceLine[]
    /** VAT in percent (0 for none) */
    vatRate: number
    currency: Currency
    /** the crypto it is paid in, and the amount fixed at making */
    symbol: string
    amount: string
    /** one token in the currency on the day it was made */
    rate: number
    to: string
    note: string
    /** the payment request that recognises the payment */
    requestId: string
}

const KEY = 'bv-invoices'
const SELLER = 'bv-invoice-seller'

function load<T>(key: string, fallback: T): T {
    try {
        return { ...fallback, ...JSON.parse(localStorage.getItem(key) || 'null') } as T
    } catch {
        return fallback
    }
}

export const invoices = reactive<{ list: Invoice[], seller: Party & { vat: string } }>({
    list: (load<{ list: Invoice[] }>(KEY, { list: [] })).list || [],
    seller: load(SELLER, { name: '', details: '', vat: '' })
})

watch(() => invoices.list, list => {
    try {
        localStorage.setItem(KEY, JSON.stringify({ list }))
    } catch { }
}, { deep: true })
watch(() => invoices.seller, s => {
    try {
        localStorage.setItem(SELLER, JSON.stringify(s))
    } catch { }
}, { deep: true })

const cents = (n: number) => Math.round(n * 100) / 100

export function invoiceTotals(lines: InvoiceLine[], vatRate: number) {
    const net = cents(lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0))
    const vat = cents(net * (Number(vatRate) || 0) / 100)
    return { net, vat, total: cents(net + vat) }
}

/** the next number this year: 2026-001, 2026-002 … */
export function nextInvoiceNumber(list: { number: string }[], now = new Date()): string {
    const year = String(now.getFullYear())
    const used = list.map(i => i.number).filter(n => n.startsWith(`${year}-`)).map(n => Number(n.slice(5)) || 0)
    return `${year}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`
}

export function dueDate(inv: Pick<Invoice, 'createdAt' | 'dueDays'>): number {
    return inv.createdAt + inv.dueDays * 86400 * 1000
}

export type InvoiceLabels = {
    title: string, number: string, date: string, due: string, from: string, to: string, vatNumber: string,
    item: string, qty: string, price: string, total: string, net: string, vat: string, pay: string, rate: string, paid: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const lines = (s: string) => esc(s).replace(/\n/g, '<br>')

/** the invoice as a page to print or save as PDF; text only, the QR code drawn from the link */
export function invoiceHtml(inv: Invoice, l: InvoiceLabels, link: string, opts: { lang: string, paid: boolean }): string {
    const money = (n: number) => new Intl.NumberFormat(opts.lang, { style: 'currency', currency: inv.currency }).format(n)
    const date = (t: number) => new Date(t).toLocaleDateString(opts.lang, { day: 'numeric', month: 'long', year: 'numeric' })
    const t = invoiceTotals(inv.lines, inv.vatRate)
    const rows = inv.lines.map(x => `<tr><td>${esc(x.text)}</td><td class="n">${esc(String(x.qty))}</td><td class="n">${money(x.price)}</td><td class="n">${money(x.qty * x.price)}</td></tr>`).join('')
    const qr = /^https:\/\//.test(link) ? new QRCode({ content: link, container: 'svg-viewbox', join: true, padding: 0 }).svg() : ''
    return `<!doctype html><html lang="${esc(opts.lang)}"><head><meta charset="utf-8"><title>${esc(l.title)} ${esc(inv.number)}</title>
<style>
@page { margin: 16mm }
body { font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; margin: 0 }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px }
h1 { font-size: 26px; margin: 0 0 4px }
.meta td { padding: 1px 12px 1px 0; color: #444 }
.parties { display: flex; gap: 32px; margin: 22px 0 }
.parties div { flex: 1 }
.parties h2 { font-size: 11px; color: #777; font-weight: 600; margin: 0 0 4px }
table.items { border-collapse: collapse; width: 100% }
table.items th { text-align: left; font-size: 11px; color: #777; border-bottom: 1px solid #bbb; padding: 6px 0 }
table.items td { border-bottom: 1px solid #e3e3e3; padding: 7px 0; vertical-align: top }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; padding-left: 12px }
.totals { margin-left: auto; margin-top: 10px; border-collapse: collapse }
.totals td { padding: 3px 0 3px 24px; text-align: right; font-variant-numeric: tabular-nums }
.totals tr.grand td { font-weight: 800; font-size: 15px; border-top: 1px solid #111; padding-top: 6px }
.pay { display: flex; gap: 18px; align-items: center; margin-top: 26px; padding: 14px; border: 1px solid #ddd; border-radius: 8px }
.pay svg { width: 120px; height: 120px; flex: none }
.pay .amount { font-size: 17px; font-weight: 800 }
.pay .addr, .pay .link { word-break: break-all; font-size: 11px; color: #555 }
.paid { color: #0a7a4f; font-weight: 800; font-size: 15px }
.note { margin-top: 18px; color: #444 }
</style></head><body>
<header>
<div><h1>${esc(l.title)}</h1><table class="meta">
<tr><td>${esc(l.number)}</td><td>${esc(inv.number)}</td></tr>
<tr><td>${esc(l.date)}</td><td>${date(inv.createdAt)}</td></tr>
<tr><td>${esc(l.due)}</td><td>${date(dueDate(inv))}</td></tr>
</table></div>
${opts.paid ? `<div class="paid">${esc(l.paid)}</div>` : ''}
</header>
<div class="parties">
<div><h2>${esc(l.from)}</h2><strong>${esc(inv.seller.name)}</strong><br>${lines(inv.seller.details)}${inv.seller.vat ? `<br>${esc(l.vatNumber)} ${esc(inv.seller.vat)}` : ''}</div>
<div><h2>${esc(l.to)}</h2><strong>${esc(inv.buyer.name)}</strong><br>${lines(inv.buyer.details)}</div>
</div>
<table class="items"><thead><tr><th>${esc(l.item)}</th><th class="n">${esc(l.qty)}</th><th class="n">${esc(l.price)}</th><th class="n">${esc(l.total)}</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals">
<tr><td>${esc(l.net)}</td><td>${money(t.net)}</td></tr>
<tr><td>${esc(l.vat)} ${esc(String(inv.vatRate))}%</td><td>${money(t.vat)}</td></tr>
<tr class="grand"><td>${esc(l.total)}</td><td>${money(t.total)}</td></tr>
</table>
<div class="pay">${qr}<div>
<div>${esc(l.pay)}</div>
<div class="amount">${esc(inv.amount)} ${esc(inv.symbol)}</div>
<div class="addr">${esc(inv.to)}</div>
<div class="addr">${esc(l.rate)}</div>
${/^https:\/\//.test(link) ? `<div class="link">${esc(link)}</div>` : ''}
</div></div>
${inv.note ? `<div class="note">${lines(inv.note)}</div>` : ''}
</body></html>`
}
