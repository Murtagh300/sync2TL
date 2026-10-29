import type { DatabaseSync } from 'node:sqlite'

/**
 * A leaderboard of VeBetterDAO's X2Earn: the B3TR each address got from the rewards pool,
 * per day, read from the chain (RewardDistributed) and kept for 35 days. About 15,000 rewards a
 * day go to a few thousand addresses, too much for a phone to add up; here it's one table.
 * Public chain data only.
 */

export const REWARDS_POOL = '0x6bee7ddab6c99d5b2af0554eaea484ce18f52631'
// RewardDistributed(uint256 amount, bytes32 indexed appId, address indexed receiver, string proof, address indexed distributor)
export const REWARD_DISTRIBUTED = '0x4811710b0c25cc7e05baf214b3a939cf893f1cbff4d0b219e680f069a4f204a2'

const KEEP_DAYS = 35
const BLOCKS_PER_DAY = 8640
const STEP = 4000

type Log = { topics: string[], data: string, meta: { blockTimestamp: number } }

export type Row = { address: string, b3tr: number, actions: number }
export type Board = { days: number, total: number, top: Row[], you: (Row & { rank: number }) | null }

/** one reward: who got how much (whole B3TR), and on which day (UTC) */
export function parseReward(log: Log): { day: string, receiver: string, b3tr: number } | null {
    if (log.topics[0] !== REWARD_DISTRIBUTED || !log.topics[2] || !log.data || log.data.length < 66) return null
    const wei = BigInt('0x' + log.data.slice(2, 66))
    return {
        day: new Date(log.meta.blockTimestamp * 1000).toISOString().slice(0, 10),
        receiver: '0x' + log.topics[2].slice(-40).toLowerCase(),
        // to a thousandth of a B3TR: plenty for a ranking
        b3tr: Number(wei / 10n ** 15n) / 1000
    }
}

export function createX2Index(opts: { db: DatabaseSync, nodes: string[], fetch?: typeof fetch, now?: () => number }) {
    const { db } = opts
    const get = opts.fetch || fetch
    const now = opts.now || Date.now
    const add = db.prepare(`INSERT INTO x2_daily (day, address, b3tr, actions) VALUES (?, ?, ?, 1)
        ON CONFLICT (day, address) DO UPDATE SET b3tr = b3tr + excluded.b3tr, actions = actions + 1`)
    const readState = db.prepare(`SELECT value FROM state WHERE key = 'x2.block'`)
    const writeState = db.prepare(`INSERT INTO state (key, value) VALUES ('x2.block', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`)
    const prune = db.prepare('DELETE FROM x2_daily WHERE day < ?')
    const sums = db.prepare('SELECT address, SUM(b3tr) AS b3tr, SUM(actions) AS actions FROM x2_daily WHERE day >= ? GROUP BY address ORDER BY b3tr DESC')
    const cache = new Map<number, { at: number, rows: Row[], rank: Map<string, number> }>()
    let running = false

    async function node<T>(path: string, body?: unknown): Promise<T> {
        let last: unknown
        for (const n of opts.nodes) {
            try {
                const resp = await get(`${n.replace(/\/$/, '')}${path}`, body === undefined
                    ? { signal: AbortSignal.timeout(15000) }
                    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) })
                if (!resp.ok) throw new Error(`node ${resp.status}`)
                return await resp.json() as T
            } catch (err) {
                last = err
            }
        }
        throw last
    }

    /** reads from where it stopped up to the head (catching up 35 days on a first start) */
    async function tick() {
        if (running) return
        running = true
        try {
            const head = (await node<{ number: number }>('/blocks/best')).number
            const saved = (readState.get() as { value: string } | undefined)?.value
            let from = saved ? Number(saved) + 1 : head - KEEP_DAYS * BLOCKS_PER_DAY
            while (from <= head) {
                const to = Math.min(head, from + STEP - 1)
                const logs: Log[] = []
                for (let offset = 0; ; offset += 1000) {
                    const page = await node<Log[]>('/logs/event', {
                        range: { unit: 'block', from, to },
                        options: { offset, limit: 1000 },
                        criteriaSet: [{ address: REWARDS_POOL, topic0: REWARD_DISTRIBUTED }],
                        order: 'asc'
                    })
                    logs.push(...page)
                    if (page.length < 1000) break
                }
                db.exec('BEGIN')
                try {
                    for (const l of logs) {
                        const r = parseReward(l)
                        if (r) add.run(r.day, r.receiver, r.b3tr)
                    }
                    writeState.run(String(to))
                    db.exec('COMMIT')
                } catch (err) {
                    db.exec('ROLLBACK')
                    throw err
                }
                from = to + 1
            }
            prune.run(new Date(now() - KEEP_DAYS * 86400 * 1000).toISOString().slice(0, 10))
        } catch (err) {
            console.warn('[x2earn]', (err as Error).message)
        } finally {
            running = false
        }
    }

    /** the ranking over the last days, worked out at most every 5 minutes */
    function board(days: number, address?: string): Board {
        let c = cache.get(days)
        if (!c || now() - c.at > 5 * 60 * 1000) {
            const since = new Date(now() - (days - 1) * 86400 * 1000).toISOString().slice(0, 10)
            const rows = (sums.all(since) as Row[]).map(r => ({ address: r.address, b3tr: Math.round(r.b3tr * 1000) / 1000, actions: r.actions }))
            c = { at: now(), rows, rank: new Map(rows.map((r, i) => [r.address, i + 1])) }
            cache.set(days, c)
        }
        const a = (address || '').toLowerCase()
        const rank = c.rank.get(a)
        return { days, total: c.rows.length, top: c.rows.slice(0, 50), you: rank ? { ...c.rows[rank - 1]!, rank } : null }
    }

    return {
        tick,
        board,
        start() {
            void tick()
            setInterval(() => void tick(), 60 * 1000).unref()
        }
    }
}
