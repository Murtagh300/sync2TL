import { address } from 'thor-devkit'

/**
 * A request to be paid, as a link: opening it (or scanning its QR code) in BlackVault
 * fills in the send form. A bare address is a request without an amount.
 */
export type PaymentRequest = { to: string, amount?: string, symbol?: string }

export function buildPaymentLink(req: PaymentRequest, base = window.location.origin + window.location.pathname): string {
    const params = new URLSearchParams({ to: address.toChecksumed(req.to) })
    if (req.amount) params.set('amount', req.amount)
    if (req.symbol) params.set('symbol', req.symbol)
    return `${base}#/send?${params.toString()}`
}

// thor-devkit's test() is a type guard, which narrows the text away when it fails
const isAddress = (v: string): boolean => address.test(v)

/** a payment request from scanned or pasted text, or null when it is not one */
export function parsePaymentRequest(text: string): PaymentRequest | null {
    const t: string = text.trim()
    if (isAddress(t)) {
        return { to: t }
    }
    const at = t.indexOf('#/send?')
    if (at < 0) {
        return null
    }
    const params = new URLSearchParams(t.slice(at + '#/send?'.length))
    const to = params.get('to') || ''
    if (!isAddress(to)) {
        return null
    }
    const amount = params.get('amount') || undefined
    const symbol = params.get('symbol') || undefined
    return {
        to,
        ...(amount && /^\d+(\.\d+)?$/.test(amount) ? { amount } : {}),
        ...(symbol && /^[A-Za-z0-9.]{1,16}$/.test(symbol) ? { symbol } : {})
    }
}
