import type { DatabaseSync } from 'node:sqlite'
import { blake2b256, Certificate, secp256k1 } from 'thor-devkit'

/**
 * Encrypted chat between addresses. The server only ever holds ciphertext: the wallet encrypts each
 * message for the chat keys of both sides (utils/message-crypto.ts) before it leaves the device.
 *
 * - A chat key is a key pair the wallet makes per device, for chat only (it can't move funds). Its
 *   public half is published here with a certificate signed by the address's own key, so nobody can
 *   put up a key for an address that isn't theirs.
 * - Sending and reading are signed with the chat key: only the owner of an address lists its inbox,
 *   and a message's sender is who signed it.
 * - Messages go after 90 days.
 */

export const KEY_CONTENT = /^BlackVault chat key (04[0-9a-f]{128})$/
export const MAX_KEYS = 5
export const MAX_BLOB = 8192
const SKEW = 10 * 60 * 1000
const KEEP = 90 * 86400 * 1000

const ADDRESS = /^0x[0-9a-f]{40}$/
const HEX = /^0x[0-9a-f]+$/

export type ChatMessage = { id: number, from: string, to: string, blob: string, at: number }

/** what a chat key signs: a hash of the text, as the wallet makes it */
export function chatHash(text: string): Buffer {
    return blake2b256(Buffer.from(text, 'utf8'))
}

/** the public key (hex, uncompressed) that signed this text, or null */
export function signerKey(text: string, sig: string): string | null {
    try {
        if (!/^0x[0-9a-f]{130}$/.test(sig)) return null
        return '0x' + secp256k1.recover(chatHash(text), Buffer.from(sig.slice(2), 'hex')).toString('hex')
    } catch {
        return null
    }
}

/** a certificate that publishes a chat key: the address that signed it, and the key */
export function verifyKeyCert(raw: unknown, now = Date.now()): { address: string, key: string } {
    const cert = raw as Certificate
    if (!cert || typeof cert !== 'object' || cert.purpose !== 'identification' || cert.payload?.type !== 'text') throw new Error('not a chat key certificate')
    const m = KEY_CONTENT.exec(String(cert.payload.content || ''))
    if (!m) throw new Error('not a chat key certificate')
    if (Math.abs(now - Number(cert.timestamp) * 1000) > SKEW) throw new Error('certificate too old')
    try {
        Certificate.verify(cert)
    } catch {
        throw new Error('bad signature')
    }
    // the wallet checks the point is on the curve before it encrypts to it (message-crypto.ts)
    return { address: cert.signer.toLowerCase(), key: '0x' + m[1]! }
}

export function createChat(db: DatabaseSync, opts: { now?: () => number, onMessage?: (m: ChatMessage) => void } = {}) {
    const now = opts.now || Date.now
    const insertKey = db.prepare('INSERT INTO chat_keys (address, pubkey, created_at) VALUES (?, ?, ?) ON CONFLICT (address, pubkey) DO UPDATE SET created_at = excluded.created_at')
    const keysOf = db.prepare('SELECT pubkey FROM chat_keys WHERE address = ? ORDER BY created_at DESC')
    const trimKeys = db.prepare('DELETE FROM chat_keys WHERE address = ? AND pubkey NOT IN (SELECT pubkey FROM chat_keys WHERE address = ? ORDER BY created_at DESC LIMIT ?)')
    const insertMsg = db.prepare('INSERT INTO chat_messages (from_addr, to_addr, blob, at) VALUES (?, ?, ?, ?)')
    const inbox = db.prepare(`SELECT id, from_addr AS "from", to_addr AS "to", blob, at FROM chat_messages
        WHERE (to_addr = ? OR from_addr = ?) AND id > ? ORDER BY id DESC LIMIT 300`)
    const prune = db.prepare('DELETE FROM chat_messages WHERE at < ?')

    const keys = (a: string) => (keysOf.all(a.toLowerCase()) as { pubkey: string }[]).map(r => r.pubkey)

    /** the address whose chat key signed this text, when it is one of that address's keys */
    function signedBy(a: string, text: string, sig: string): boolean {
        const key = signerKey(text, sig)
        return !!key && keys(a).includes(key)
    }

    function fresh(at: number) {
        if (!Number.isFinite(at) || Math.abs(now() - at) > SKEW) throw new Error('clock out of range')
    }

    return {
        keys,
        publish(cert: unknown) {
            const { address: a, key } = verifyKeyCert(cert, now())
            insertKey.run(a, key, now())
            trimKeys.run(a, a, MAX_KEYS)
            return { address: a, key }
        },
        send(raw: unknown): ChatMessage {
            const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
            const from = String(r.from || '').toLowerCase()
            const to = String(r.to || '').toLowerCase()
            const blob = String(r.blob || '').toLowerCase()
            const at = Number(r.at)
            if (!ADDRESS.test(from) || !ADDRESS.test(to) || from === to) throw new Error('bad addresses')
            if (!HEX.test(blob) || blob.length > MAX_BLOB) throw new Error('bad message')
            fresh(at)
            if (!signedBy(from, `send|${from}|${to}|${at}|${blob}`, String(r.sig || '').toLowerCase())) throw new Error('not signed by the sender')
            if (!keys(to).length) throw new Error('the recipient has no chat key')
            const id = Number(insertMsg.run(from, to, blob, at).lastInsertRowid)
            const m = { id, from, to, blob, at }
            opts.onMessage?.(m)
            return m
        },
        read(raw: unknown): ChatMessage[] {
            const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
            const a = String(r.address || '').toLowerCase()
            const since = Math.max(0, Math.floor(Number(r.since) || 0))
            const at = Number(r.at)
            if (!ADDRESS.test(a)) throw new Error('bad address')
            fresh(at)
            if (!signedBy(a, `inbox|${a}|${at}`, String(r.sig || '').toLowerCase())) throw new Error('not signed by the owner')
            // the newest first from the database, handed back oldest first
            return (inbox.all(a, a, since) as ChatMessage[]).reverse()
        },
        prune() {
            prune.run(now() - KEEP)
        }
    }
}
