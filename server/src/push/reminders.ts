import type { DatabaseSync } from 'node:sqlite'
import type { Store, Subscription } from './store.ts'

/**
 * Reminders a device asked for (a recurring buy: "time for your weekly B3TR"), pushed when due and
 * set to the next time. The device writes the text in its own language and replaces its whole list
 * each time; the server keeps no more than that. Nothing here can move funds: tapping one opens the
 * wallet's swap, filled in, to sign there.
 */

export const MAX_REMINDERS = 20
const EVERY = ['day', 'week', 'month'] as const
type Every = typeof EVERY[number]

export type Reminder = { id: string, next: number, every: Every, title: string, body: string, url: string }

const text = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max).trim() : ''

/** the wallet's own pages only, with a plain query (as the push service worker accepts them) */
const URL_OK = /^#\/[a-z0-9/-]*(\?[a-z0-9=&%._-]*)?$/i

export function validateReminders(raw: unknown): { endpoint: string, reminders: Reminder[] } {
    const body = (raw || {}) as { endpoint?: unknown, reminders?: unknown }
    if (typeof body.endpoint !== 'string' || !body.endpoint) throw new Error('endpoint missing')
    if (!Array.isArray(body.reminders)) throw new Error('reminders missing')
    if (body.reminders.length > MAX_REMINDERS) throw new Error(`at most ${MAX_REMINDERS} reminders`)
    const reminders = body.reminders.map((r: unknown) => {
        const o = (r || {}) as Record<string, unknown>
        const id = text(o.id, 32)
        const next = Number(o.next)
        const every = o.every as Every
        const url = text(o.url, 300)
        if (!/^[a-z0-9]+$/i.test(id)) throw new Error('bad id')
        if (!Number.isFinite(next) || next <= 0) throw new Error('bad next')
        if (!EVERY.includes(every)) throw new Error('bad every')
        if (!URL_OK.test(url)) throw new Error('bad url')
        const title = text(o.title, 80)
        if (!title) throw new Error('title missing')
        return { id, next: Math.floor(next), every, title, body: text(o.body, 120), url }
    })
    return { endpoint: body.endpoint, reminders }
}

/** the time after `next`, past `now` (a week missed while offline is one reminder, not seven) */
export function nextAfter(next: number, every: Every, now: number): number {
    const d = new Date(next)
    do {
        if (every === 'day') d.setUTCDate(d.getUTCDate() + 1)
        else if (every === 'week') d.setUTCDate(d.getUTCDate() + 7)
        else d.setUTCMonth(d.getUTCMonth() + 1)
    } while (d.getTime() <= now)
    return d.getTime()
}

export function createReminders(db: DatabaseSync, store: Store) {
    const clear = db.prepare('DELETE FROM reminders WHERE endpoint = ?')
    const insert = db.prepare('INSERT INTO reminders (endpoint, id, next, every, title, body, url) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const due = db.prepare(`SELECT r.endpoint, r.id, r.next, r.every, r.title, r.body, r.url, s.keys, s.lang FROM reminders r
        JOIN subscriptions s ON s.endpoint = r.endpoint WHERE r.next <= ? LIMIT 500`)
    const setNext = db.prepare('UPDATE reminders SET next = ? WHERE endpoint = ? AND id = ?')

    return {
        /** a subscribed device's list, replaced; false when the endpoint isn't subscribed */
        replace(endpoint: string, reminders: Reminder[]): boolean {
            if (!store.has(endpoint)) return false
            db.exec('BEGIN')
            try {
                clear.run(endpoint)
                for (const r of reminders) insert.run(endpoint, r.id, r.next, r.every, r.title, r.body, r.url)
                db.exec('COMMIT')
            } catch (err) {
                db.exec('ROLLBACK')
                throw err
            }
            return true
        },
        /** push what is due and set each to its next time */
        async tick(send: (sub: Subscription, payload: string) => Promise<void>, now = Date.now()) {
            const rows = due.all(now) as { endpoint: string, id: string, next: number, every: Every, title: string, body: string, url: string, keys: string, lang: string }[]
            for (const r of rows) {
                // set first: a failing push service doesn't make it fire every minute
                setNext.run(nextAfter(r.next, r.every, now), r.endpoint, r.id)
                try {
                    await send({ endpoint: r.endpoint, keys: JSON.parse(r.keys), lang: r.lang },
                        JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: `reminder:${r.id}` }))
                } catch (err) {
                    console.warn('[push] reminder:', (err as Error).message)
                }
            }
            return rows.length
        }
    }
}
