import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * The server's own data, in SQLite (built into Node): push subscriptions with the addresses
 * they watch, reminders they asked for, the last block the watcher read, X2Earn rewards per day for
 * the leaderboard, and opt-in error reports. Migrations run in
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
    `CREATE INDEX reminders_next ON reminders(next)`,
    // X2Earn rewards per address per day, for the leaderboard (x2earn.ts); public chain data
    `CREATE TABLE x2_daily (
        day TEXT NOT NULL,
        address TEXT NOT NULL,
        b3tr REAL NOT NULL,
        actions INTEGER NOT NULL,
        PRIMARY KEY (day, address)
    )`,
    // encrypted chat (chat.ts): public chat keys per address, and ciphertext only
    `CREATE TABLE chat_keys (
        address TEXT NOT NULL,
        pubkey TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (address, pubkey)
    )`,
    `CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        blob TEXT NOT NULL,
        at INTEGER NOT NULL
    )`,
    `CREATE INDEX chat_to ON chat_messages(to_addr, id)`,
    `CREATE INDEX chat_from ON chat_messages(from_addr, id)`
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
