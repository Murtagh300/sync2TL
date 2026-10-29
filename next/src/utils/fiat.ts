/**
 * The money amounts are shown in: euros and dollars, and the currencies the European Central Bank
 * publishes a daily rate for that people using the wallet's languages pay in. Prices come in
 * dollars (BetterSwap); a currency is the ECB's rate for it divided by its rate for the dollar.
 */

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CNY', 'KRW', 'AUD', 'CAD', 'BRL', 'TRY', 'PLN', 'IDR', 'SEK', 'NOK', 'DKK', 'CZK', 'INR'] as const
export type Currency = typeof CURRENCIES[number]

export function isCurrency(v: unknown): v is Currency {
    return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v)
}

/** the currency's sign as the user's language writes it ("€", "$", "zł"...) */
export function currencySign(currency: string, locale?: string): string {
    try {
        const part = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
            .formatToParts(0).find(p => p.type === 'currency')
        return part?.value || currency
    } catch {
        return currency
    }
}

/** units of a currency per dollar, from ECB rates (units per euro); 0 when either is missing */
export function perDollar(rates: Record<string, number>, currency: string): number {
    if (currency === 'USD') return 1
    const usd = rates.USD
    const c = currency === 'EUR' ? 1 : rates[currency]
    return usd && c ? c / usd : 0
}

/** the ECB's daily reference rates (eurofxref-daily.xml): units per euro */
export function parseEcb(xml: string): Record<string, number> {
    const out: Record<string, number> = {}
    for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
        const v = Number(m[2])
        if (v > 0) out[m[1]!] = v
    }
    return out
}
