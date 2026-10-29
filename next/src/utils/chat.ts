import { blake2b256, secp256k1 } from 'thor-devkit'
import { serverUrl } from './endpoints'
import { decryptMessage, encryptMessage } from './message-crypto'

/**
 * Encrypted chat between addresses, through the BlackVault server (server/src/chat.ts), which only
 * ever holds ciphertext.
 *
 * Each device makes a chat key per address: a key pair for chat only, kept here, never able to move
 * funds. Its public half goes to the server with a certificate the address signs once, so nobody
 * can publish a key for an address that isn't theirs. A message is encrypted for every chat key of
 * both sides (so your other devices read it too), and signed with the sender's chat key.
 * Losing this device's chat key loses only the old messages on it; a new one is made.
 */

export const MAX_CHAT = 1000
const KEY = 'bv-chat-keys'

export type ChatLine = { id: number, from: string, to: string, at: number, text: string | null }

function loadKeys(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, string>
    } catch {
        return {}
    }
}

/** this device's chat key for an address, if it has one */
export function chatKeyOf(address: string): Buffer | null {
    const hex = loadKeys()[address.toLowerCase()]
    return hex ? Buffer.from(hex, 'hex') : null
}

/** a new chat key for an address (kept once its certificate is accepted) */
export function newChatKey(): { priv: Buffer, pub: string } {
    const priv = secp256k1.generatePrivateKey()
    return { priv, pub: secp256k1.derivePublicKey(priv).toString('hex') }
}

export function keepChatKey(address: string, priv: Buffer) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...loadKeys(), [address.toLowerCase()]: priv.toString('hex') }))
    } catch { }
}

/** the text the address signs to publish a key */
export const keyCertContent = (pub: string) => `BlackVault chat key ${pub}`

const sign = (text: string, priv: Buffer) => '0x' + secp256k1.sign(blake2b256(Buffer.from(text, 'utf8')), priv).toString('hex')

async function post<T>(path: string, body: unknown): Promise<T> {
    const r = await fetch(`${serverUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const b = await r.json().catch(() => ({})) as T & { error?: string }
    if (!r.ok) throw new Error(b.error || `chat ${r.status}`)
    return b
}

export const chatAvailable = () => serverUrl !== null

export function publishKey(cert: unknown) {
    return post<{ address: string, key: string }>('/chat/key', cert)
}

export async function keysOf(address: string): Promise<Buffer[]> {
    const r = await fetch(`${serverUrl}/chat/keys/${address.toLowerCase()}`)
    if (!r.ok) throw new Error(`chat ${r.status}`)
    const { keys } = await r.json() as { keys: string[] }
    return keys.map(k => Buffer.from(k.slice(2), 'hex'))
}

/** sends text from one address to another; false when the other side has no chat yet */
export async function sendChat(from: string, to: string, text: string): Promise<boolean> {
    const priv = chatKeyOf(from)
    if (!priv) throw new Error('no chat key')
    const [theirs, mine] = await Promise.all([keysOf(to), keysOf(from)])
    if (!theirs.length) return false
    const blob = await encryptMessage(text, [...theirs, ...mine], MAX_CHAT)
    const f = from.toLowerCase()
    const t = to.toLowerCase()
    const at = Date.now()
    await post('/chat/send', { from: f, to: t, blob, at, sig: sign(`send|${f}|${t}|${at}|${blob}`, priv) })
    return true
}

/** an address's messages since an id, decrypted (null text: not readable on this device) */
export async function readChat(address: string, since = 0): Promise<ChatLine[]> {
    const priv = chatKeyOf(address)
    if (!priv) return []
    const a = address.toLowerCase()
    const at = Date.now()
    const { messages } = await post<{ messages: { id: number, from: string, to: string, blob: string, at: number }[] }>('/chat/inbox', { address: a, since, at, sig: sign(`inbox|${a}|${at}`, priv) })
    return Promise.all(messages.map(async m => ({
        id: m.id,
        from: m.from,
        to: m.to,
        at: m.at,
        text: await decryptMessage(m.blob, priv).catch(() => null)
    })))
}

export type Conversation = { with: string, last: ChatLine, unread: number }

/** messages grouped by the other side, newest conversation first */
export function conversations(lines: ChatLine[], me: string, seen: Record<string, number> = {}): Conversation[] {
    const m = me.toLowerCase()
    const by = new Map<string, Conversation>()
    for (const l of lines) {
        const other = l.from === m ? l.to : l.from
        const c = by.get(other) || { with: other, last: l, unread: 0 }
        if (l.id >= c.last.id) c.last = l
        if (l.from !== m && l.id > (seen[other] || 0)) c.unread++
        by.set(other, c)
    }
    return [...by.values()].sort((a, b) => b.last.id - a.last.id)
}
