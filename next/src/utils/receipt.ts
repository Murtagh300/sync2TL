/**
 * A receipt for a payment, as a page to print or save as PDF (the system's print dialog has
 * "Save as PDF" on every platform): who paid whom, what, when, and the transaction, so the
 * other side can check it on the explorer. Built from text only: nothing from the chain is
 * put in as markup.
 */

export type Receipt = {
    title: string
    /** labelled lines: amount, from, to, date, transaction… */
    lines: { label: string, value: string }[]
    /** a link to the transaction on the explorer */
    link?: string
    footer: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function receiptHtml(r: Receipt, lang = 'en'): string {
    const rows = r.lines.map(l => `<tr><th>${esc(l.label)}</th><td>${esc(l.value)}</td></tr>`).join('')
    return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(r.title)}</title>
<style>
@page { margin: 18mm }
body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; margin: 0 }
.brand { font-weight: 800; letter-spacing: .02em; font-size: 13px; color: #555 }
h1 { font-size: 22px; margin: 6px 0 18px }
table { border-collapse: collapse; width: 100% }
th, td { text-align: left; vertical-align: top; padding: 8px 0; border-bottom: 1px solid #ddd }
th { width: 34%; color: #555; font-weight: 600 }
td { word-break: break-all; font-variant-numeric: tabular-nums }
.link { margin-top: 14px; font-size: 12px; word-break: break-all }
footer { margin-top: 28px; font-size: 11px; color: #777 }
</style></head><body>
<div class="brand">BlackVault</div>
<h1>${esc(r.title)}</h1>
<table>${rows}</table>
${r.link && /^https:\/\//.test(r.link) ? `<div class="link">${esc(r.link)}</div>` : ''}
<footer>${esc(r.footer)}</footer>
</body></html>`
}

/** opens the print dialog for a receipt (a hidden frame: no pop-up to allow) */
export function printReceipt(r: Receipt, lang?: string) {
    printPage(receiptHtml(r, lang))
}

/** the print dialog for a page this app wrote (an invoice, a receipt) */
export function printPage(html: string) {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    // a sandboxed frame without scripts: it only shows the page
    frame.setAttribute('sandbox', 'allow-modals allow-same-origin')
    document.body.appendChild(frame)
    const doc = frame.contentDocument
    if (!doc) {
        frame.remove()
        return
    }
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
        try {
            frame.contentWindow?.focus()
            frame.contentWindow?.print()
        } finally {
            setTimeout(() => frame.remove(), 60 * 1000)
        }
    }, 150)
}
