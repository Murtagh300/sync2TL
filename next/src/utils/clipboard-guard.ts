/**
 * Clipboard malware swaps a copied address for the attacker's, usually one that starts and ends
 * the same so a glance doesn't catch it. The wallet remembers the address it last copied (or read
 * from a QR code) and checks what is pasted against it.
 */

const KEY = 'bv-last-copied'
/** a paste this long after copying is still compared */
export const WINDOW = 30 * 60 * 1000

type Copied = { address: string, at: number }

const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s)

export function noteCopied(text: string, now = Date.now()) {
    const t = text.trim()
    if (!isAddress(t)) return
    try {
        sessionStorage.setItem(KEY, JSON.stringify({ address: t.toLowerCase(), at: now }))
    } catch { }
}

function lastCopied(): Copied | null {
    try {
        return JSON.parse(sessionStorage.getItem(KEY) || 'null') as Copied | null
    } catch {
        return null
    }
}

/**
 * 'swapped': looks like what was copied (same start and end) but isn't: almost surely malware;
 * 'different': another address than the one just copied: worth a look; null: nothing to say
 */
export function checkPasted(text: string, now = Date.now(), copied = lastCopied()): 'swapped' | 'different' | null {
    const t = text.trim().toLowerCase()
    if (!isAddress(t) || !copied || now - copied.at > WINDOW || t === copied.address) return null
    const c = copied.address
    const alike = t.slice(2, 6) === c.slice(2, 6) || t.slice(-4) === c.slice(-4)
    return alike ? 'swapped' : 'different'
}
