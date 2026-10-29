import { reactive, watch } from 'vue'
import { address as addr, secp256k1, Transaction } from 'thor-devkit'
import { randomBytes } from 'crypto'
import { fns } from './actions'
import { signHash } from 'src/core/sign'
import { sweepClauses, type Clause } from './sweep'

/**
 * Money links: send crypto to someone without a wallet, over WhatsApp or mail. The wallet makes a
 * fresh key, sends the amount (and a little VTHO for the fee of picking it up) to that key's address,
 * and the link carries the key, after the #: the part of a link no server ever sees. Whoever opens
 * the link moves it into a wallet of their own; until then, the sender can take it back.
 *
 * The key is kept here, as it is in the link: whoever has either has the money. That is the deal of
 * a money link, so it is meant for small amounts.
 */

const CURVE_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141')

/** VTHO that goes along: the fee of the transaction that picks the money up */
export const GIFT_VTHO = 2n * 10n ** 18n

export type Gift = {
    id: string
    /** the link's key (hex) and its address */
    key: string
    address: string
    amount: string
    symbol: string
    /** the token contract; '' for VET */
    token: string
    decimals: number
    note: string
    createdAt: number
    from: string
    txId?: string
    /** taken back by the sender (picked up by someone else shows on chain) */
    reclaimed?: boolean
}

const KEY = 'bv-gifts'

function load(): Gift[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]') as Gift[]
    } catch {
        return []
    }
}

export const gifts = reactive<{ list: Gift[] }>({ list: load() })

watch(() => gifts.list, v => {
    try {
        localStorage.setItem(KEY, JSON.stringify(v))
    } catch { }
}, { deep: true })

/** a fresh key for a money link */
export function newGiftKey(): { key: string, address: string } {
    const sk = secp256k1.generatePrivateKey()
    return { key: sk.toString('hex'), address: addr.fromPublicKey(secp256k1.derivePublicKey(sk)) }
}

export function giftId() {
    return randomBytes(6).toString('hex')
}

/** the link to share, with a short note for the one who opens it */
export function giftLink(key: string, note = '', base = window.location.origin + window.location.pathname) {
    const n = note.trim().slice(0, 80)
    return `${base}#/claim?k=${key}${n ? `&n=${encodeURIComponent(n)}` : ''}`
}

/** the key in a link or its k parameter; null when it isn't one */
export function giftKeyFrom(text: string): Buffer | null {
    const m = /(?:^|[?&#]k=)([0-9a-f]{64})(?:$|&)/i.exec(text.trim()) || /^([0-9a-f]{64})$/i.exec(text.trim())
    if (!m) return null
    const n = BigInt('0x' + m[1]!)
    // a key is a number between 1 and the order of the curve
    return n > 0n && n < CURVE_N ? Buffer.from(m[1]!, 'hex') : null
}

export function giftAddress(sk: Buffer): string {
    return addr.fromPublicKey(secp256k1.derivePublicKey(sk))
}

/** what the sender signs: the amount to the link's address, and the VTHO for picking it up */
export function giftClauses(to: string, wei: bigint, token: string, vtho: string): Clause[] {
    const out: Clause[] = []
    const vthoToo = token.toLowerCase() === vtho.toLowerCase()
    if (!token) out.push({ to, value: wei.toString(), data: '0x' })
    else if (!vthoToo) out.push({ to: token, value: '0', data: fns.transfer.encode(to, wei.toString()) })
    out.push({ to: vtho, value: '0', data: fns.transfer.encode(to, (vthoToo ? wei + GIFT_VTHO : GIFT_VTHO).toString()) })
    return out
}

/**
 * everything on the link's address to one place, the VTHO that is left after the fee included;
 * `fee` is the fee in VTHO wei the transaction will cost
 */
export function claimClauses(specs: { symbol: string, address: string, decimals: number }[], balances: bigint[], to: string, fee: bigint) {
    // the reserve in whole VTHO: the fee, rounded up, and one more to be safe
    const reserve = Number(fee / 10n ** 18n) + 1
    return sweepClauses(specs, balances, to, reserve)
}

/** a transaction signed by the link's key alone (it pays its own fee) */
export function signedClaim(sk: Buffer, body: { chainTag: number, blockRef: string, clauses: Clause[], gas: number }): string {
    const tx = new Transaction({
        chainTag: body.chainTag,
        blockRef: body.blockRef,
        expiration: 32,
        clauses: body.clauses,
        gasPriceCoef: 0,
        gas: body.gas,
        dependsOn: null,
        nonce: '0x' + randomBytes(8).toString('hex')
    })
    tx.signature = signHash(tx.signingHash(), sk)
    return '0x' + tx.encode().toString('hex')
}
