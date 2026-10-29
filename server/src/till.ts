import type { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * A till's open sale, for an NFC sticker or a printed QR code at the counter: the sticker holds a
 * link with the till's id, the till puts each new amount here, and whoever taps sees what to pay.
 *
 * - The address is fixed when the till is made: nobody can point a sticker at another address,
 *   not even with the till's secret.
 * - Only the device holding the secret (made here, kept on the till) sets the amount.
 * - A sale is shown for 15 minutes at most; nothing else is kept.
 */

export const SALE_TTL = 15 * 60 * 1000
const ADDRESS = /^0x[0-9a-f]{40}$/
const ID = /^[a-z0-9]{12}$/
const SYMBOL = /^[A-Za-z0-9.]{1,16}$/
const AMOUNT = /^\d{1,12}(\.\d{1,18})?$/

export type Sale = { amount: string, symbol: string, at: number }

const hash = (s: string) => createHash('sha256').update(s).digest()

export function createTills(db: DatabaseSync, opts: { now?: () => number } = {}) {
    const now = opts.now || Date.now
    const insert = db.prepare('INSERT INTO tills (id, address, secret, sale, updated_at) VALUES (?, ?, ?, NULL, ?)')
    const get = db.prepare('SELECT id, address, secret, sale, updated_at FROM tills WHERE id = ?')
    const setSale = db.prepare('UPDATE tills SET sale = ?, updated_at = ? WHERE id = ?')

    type Row = { id: string, address: string, secret: Buffer, sale: string | null, updated_at: number }

    function owned(id: string, secret: unknown): Row {
        const row = ID.test(id) ? get.get(id) as Row | undefined : undefined
        if (!row || typeof secret !== 'string' || !timingSafeEqual(hash(secret), Buffer.from(row.secret))) throw new Error('not this till')
        return row
    }

    return {
        /** a new till for an address: its id (public, on the sticker) and secret (the till's only) */
        create(raw: unknown): { id: string, secret: string } {
            const address = String((raw as { address?: unknown } | null)?.address || '').toLowerCase()
            if (!ADDRESS.test(address)) throw new Error('bad address')
            const id = randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(12, '0').slice(0, 12)
            const secret = randomBytes(24).toString('base64url')
            insert.run(id, address, hash(secret), now())
            return { id, secret }
        },
        /** put up a sale (or take it down with an empty amount) */
        set(id: string, raw: unknown) {
            const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
            owned(id, r.secret)
            if (!r.amount) {
                setSale.run(null, now(), id)
                return
            }
            const amount = String(r.amount)
            const symbol = String(r.symbol || '')
            if (!AMOUNT.test(amount) || !SYMBOL.test(symbol)) throw new Error('bad sale')
            setSale.run(JSON.stringify({ amount, symbol, at: now() }), now(), id)
        },
        /** what a tap shows: the address, and the open sale if there is one */
        read(id: string): { address: string, sale: Sale | null } | null {
            const row = ID.test(id) ? get.get(id) as Row | undefined : undefined
            if (!row) return null
            const sale = row.sale ? JSON.parse(row.sale) as Sale : null
            return { address: row.address, sale: sale && now() - sale.at < SALE_TTL ? sale : null }
        }
    }
}
