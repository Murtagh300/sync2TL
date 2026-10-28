import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * The server's own data, in SQLite (built into Node): push subscriptions with the addresses
 * they watch, reminders they asked for, the last block the watcher read, and opt-in error reports. Migrations run in
 * order at start and are recorded, so an upgrade never runs one twice.
 */

const MIGRATIONS: string[] = [
    `CREATE TABLE subscriptions (
        endpoint TEXT PRIMARY KEY,
        keys TEXT NOT NULL,
        addresses TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'en',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE watched (
        address TEXT NOT NULL,
        endpoint TEXT NOT NULL REFERENCES subscriptions(endpoint) ON DELETE CASCADE,
        PRIMARY KEY (address, endpoint)
    )`,
    `CREATE INDEX watched_address ON watched(address)`,
    `CREATE TABLE state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `CREATE TABLE reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at INTEGER NOT NULL,
        message TEXT NOT NULL,
        stack TEXT NOT NULL,
        route TEXT NOT NULL,
        version TEXT NOT NULL,
        ua TEXT NOT NULL
    )`,
    // reminders a device asked for (push/reminders.ts): gone with its subscription
    `CREATE TABLE reminders (
        endpoint TEXT NOT NULL REFERENCES subscriptions(endpoint) ON DELETE CASCADE,
        id TEXT NOT NULL,
        next INTEGER NOT NULL,
        every TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        url TEXT NOT NULL,
        PRIMARY KEY (endpoint, id)
    )`,
    `CREATE INDEX reminders_next ON reminders(next)`
]

export function openDb(path: string): DatabaseSync {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    const db = new DatabaseSync(path)
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    db.exec('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, at INTEGER NOT NULL)')
    const done = new Set((db.prepare('SELECT id FROM migrations').all() as { id: number }[]).map(r => r.id))
    MIGRATIONS.forEach((sql, i) => {
        if (done.has(i)) return
        db.exec('BEGIN')
        try {
            db.exec(sql)
            db.prepare('INSERT INTO migrations (id, at) VALUES (?, ?)').run(i, Date.now())
            db.exec('COMMIT')
        } catch (err) {
            db.exec('ROLLBACK')
            throw err
        }
    })
    return db
}
