import { ec as EC } from 'elliptic'
import { address, blake2b256, secp256k1, Transaction } from 'thor-devkit'

/**
 * A short message sent along with a payment, readable only by the sender and the recipient.
 *
 * It rides in an extra clause to the recipient (0 VET) as data:
 *   "BVMSG1" | ephemeral public key (65) | slot count (1) | per reader: iv (12) + wrapped key (48) | iv (12) | ciphertext
 * The content key is random (AES-256-GCM); each reader's slot wraps it with the ECDH secret of
 * the ephemeral key and that reader's public key (secp256k1). A recipient's public key is
 * recovered from a transaction it signed, so it has to have sent one before.
 */

const ec = new EC('secp256k1')
const MAGIC = Buffer.from('BVMSG1', 'utf8')
export const MESSAGE_PREFIX = '0x' + MAGIC.toString('hex')
export const MAX_MESSAGE = 200

const subtle = () => globalThis.crypto.subtle

function sharedKey(privateKey: Buffer, publicKey: Buffer): Buffer {
    // the ephemeral key comes from chain data anyone can write: a point off the curve would
    // leak bits of our private key through the shared secret (invalid-curve attack)
    if (publicKey.length !== 65 || publicKey[0] !== 4) {
        throw new Error('bad public key')
    }
    const pub = ec.keyFromPublic(publicKey)
    if (!pub.validate().result) {
        throw new Error('public key not on the curve')
    }
    const x = ec.keyFromPrivate(privateKey).derive(pub.getPublic())
    return blake2b256(Buffer.from(x.toArray('be', 32)), 'bvmsg')
}

async function aes(key: Buffer, iv: Buffer, data: Buffer, mode: 'encrypt' | 'decrypt'): Promise<Buffer> {
    // WebCrypto wants plain ArrayBuffer-backed views
    const k = await subtle().importKey('raw', new Uint8Array(key), 'AES-GCM', false, [mode])
    const params = { name: 'AES-GCM', iv: new Uint8Array(iv) }
    const out = mode === 'encrypt'
        ? await subtle().encrypt(params, k, new Uint8Array(data))
        : await subtle().decrypt(params, k, new Uint8Array(data))
    return Buffer.from(out)
}

const random = (n: number) => Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(n)))

export function isMessageData(data: string | null | undefined) {
    return !!data && data.toLowerCase().startsWith(MESSAGE_PREFIX)
}

/** the message as clause data, readable by each of these public keys */
export async function encryptMessage(text: string, readers: Buffer[], max = MAX_MESSAGE): Promise<string> {
    const plain = Buffer.from(text.slice(0, max), 'utf8')
    const ephemeral = secp256k1.generatePrivateKey()
    const ephemeralPub = secp256k1.derivePublicKey(ephemeral)
    const contentKey = random(32)
    const slots: Buffer[] = []
    for (const pub of readers) {
        const iv = random(12)
        slots.push(Buffer.concat([iv, await aes(sharedKey(ephemeral, pub), iv, contentKey, 'encrypt')]))
    }
    const iv = random(12)
    const body = await aes(contentKey, iv, plain, 'encrypt')
    return '0x' + Buffer.concat([MAGIC, ephemeralPub, Buffer.from([slots.length]), ...slots, iv, body]).toString('hex')
}

/** the message, if this private key is one of its readers */
export async function decryptMessage(data: string, privateKey: Buffer): Promise<string | null> {
    const buf = Buffer.from(data.slice(2), 'hex')
    let at = MAGIC.length
    const ephemeralPub = buf.subarray(at, at + 65); at += 65
    const n = buf[at]!; at += 1
    const shared = sharedKey(privateKey, ephemeralPub)
    let contentKey: Buffer | null = null
    for (let i = 0; i < n; i++) {
        const slot = buf.subarray(at + i * 60, at + (i + 1) * 60)
        try {
            contentKey = await aes(shared, slot.subarray(0, 12), slot.subarray(12), 'decrypt')
            break
        } catch {
            // not this reader's slot
        }
    }
    at += n * 60
    if (!contentKey) {
        return null
    }
    const plain = await aes(contentKey, buf.subarray(at, at + 12), buf.subarray(at + 12), 'decrypt')
    return plain.toString('utf8')
}

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/**
 * the public key of an address, recovered from a transaction it signed; null when it
 * never sent one
 */
export async function publicKeyOf(thor: Connex.Thor, nodeUrl: string, addr: string): Promise<Buffer | null> {
    const a = addr.toLowerCase()
    const [vet, events] = await Promise.all([
        thor.filter('transfer', [{ sender: a }]).order('desc').apply(0, 5),
        thor.filter('event', [{ topic0: TRANSFER, topic1: '0x' + a.slice(2).padStart(64, '0') }]).order('desc').apply(0, 5)
    ])
    const txIds = [...vet, ...events].filter(r => r.meta.txOrigin.toLowerCase() === a).map(r => r.meta.txID)
    for (const id of [...new Set(txIds)]) {
        try {
            const resp = await fetch(new URL(`transactions/${id}?raw=true`, nodeUrl).href)
            const { raw } = await resp.json() as { raw: string }
            const tx = Transaction.decode(Buffer.from(raw.slice(2), 'hex'))
            const pub = secp256k1.recover(tx.signingHash(), tx.signature!.subarray(0, 65))
            if (address.fromPublicKey(pub).toLowerCase() === a) {
                return pub
            }
        } catch {
            // try the next one
        }
    }
    return null
}
