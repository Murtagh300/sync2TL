import { syncOwnReminders } from './push'
import { buyRoute, payments } from './payments'

/**
 * Recurring buys as push reminders from the BlackVault server, so they arrive while the app is
 * closed. The server keeps the time, the repeat and the text to show; tapping opens the swap.
 * Limit buys need prices: those are checked by the app while it is open (App.vue).
 */
export async function syncBuyReminders(t: (key: string, params?: Record<string, unknown>) => string) {
    try {
        await syncOwnReminders(payments.buys.filter(b => b.every).map(b => {
            const q = new URLSearchParams(buyRoute(b).query).toString()
            return {
                id: b.id,
                next: b.next,
                every: b.every!,
                title: t('buys.push_title', { symbol: b.to }),
                body: `${b.amount} ${b.from} → ${b.to}`,
                url: `#/swap?${q}`
            }
        }))
    } catch {
        // no server push: the app reminds while open
    }
}
