import type { DatabaseSync } from 'node:sqlite'
import type { Subscription } from './store.ts'

/**
 * A push when VeChain's token registry lists a new token, for the devices that asked. The list is
 * read every hour; the first reading only sets what is known. A handful at most per reading: a
 * registry that suddenly grows by dozens is a change of format, not news.
 */

export const REGISTRY = 'https://vechain.github.io/token-registry/main.json'
const MAX_PER_TICK = 3

const TEXT: Record<string, string> = {
    en: 'New on VeChain: {symbol} ({name})',
    nl: 'Nieuw op VeChain: {symbol} ({name})',
    de: 'Neu auf VeChain: {symbol} ({name})',
    fr: 'Nouveau sur VeChain : {symbol} ({name})',
    zh: 'VeChain 新代币：{symbol}（{name}）',
    es: 'Nuevo en VeChain: {symbol} ({name})',
    it: 'Nuovo su VeChain: {symbol} ({name})',
    ja: 'VeChain に新登場：{symbol}（{name}）',
    ko: 'VeChain 신규 토큰: {symbol} ({name})',
    pt: 'Novo na VeChain: {symbol} ({name})',
    tr: 'VeChain\'de yeni: {symbol} ({name})',
    vi: 'Mới trên VeChain: {symbol} ({name})',
    ru: 'Новое в VeChain: {symbol} ({name})',
    pl: 'Nowość w VeChain: {symbol} ({name})',
    id: 'Baru di VeChain: {symbol} ({name})'
}

export type RegistryToken = { address: string, symbol: string, name: string }

export function tokenText(lang: string, t: RegistryToken) {
    return (TEXT[lang] || TEXT.en!).replace('{symbol}', t.symbol.slice(0, 20)).replace('{name}', t.name.slice(0, 40))
}

export async function registryTokens(url = REGISTRY): Promise<RegistryToken[]> {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error(`registry ${r.status}`)
    const list = await r.json() as { address?: string, symbol?: string, name?: string }[]
    return list
        .filter(t => typeof t.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(t.address))
        .map(t => ({ address: t.address!.toLowerCase(), symbol: String(t.symbol || ''), name: String(t.name || '') }))
}

type Sender = (sub: Subscription, payload: string) => Promise<void>

export function createTokenWatch(db: DatabaseSync, opts: { send: Sender, tokens?: () => Promise<RegistryToken[]> }) {
    const getState = db.prepare('SELECT value FROM state WHERE key = \'tokens:known\'')
    const setState = db.prepare('INSERT INTO state (key, value) VALUES (\'tokens:known\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    const listeners = db.prepare('SELECT endpoint, keys, lang FROM subscriptions WHERE tokens = 1')
    const read = opts.tokens || (() => registryTokens())

    async function tick() {
        const list = await read()
        if (!list.length) return 0
        const saved = getState.get() as { value: string } | undefined
        setState.run(JSON.stringify(list.map(t => t.address)))
        if (!saved) return 0
        const known = new Set(JSON.parse(saved.value) as string[])
        const fresh = list.filter(t => !known.has(t.address))
        if (!fresh.length || fresh.length > 20) return 0
        let sent = 0
        for (const r of listeners.all() as { endpoint: string, keys: string, lang: string }[]) {
            for (const t of fresh.slice(0, MAX_PER_TICK)) {
                const payload = JSON.stringify({ title: tokenText(r.lang, t), body: 'BlackVault', url: '#/watchlist', tag: `token:${t.address}` })
                await opts.send({ endpoint: r.endpoint, keys: JSON.parse(r.keys), lang: r.lang }, payload)
                    .then(() => { sent++ }, err => console.warn('[push] token:', (err as Error).message))
            }
        }
        return sent
    }

    return {
        tick,
        start() {
            setInterval(() => { tick().catch(err => console.warn('[push] token tick:', (err as Error).message)) }, 60 * 60 * 1000).unref()
            tick().catch(() => { })
        }
    }
}
