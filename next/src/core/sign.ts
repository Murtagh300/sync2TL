import { secp256k1 } from '@noble/curves/secp256k1'

/**
 * Signing with @noble/curves rather than thor-devkit's `elliptic`, which can produce a faulty
 * signature when RFC 6979's nonce has a leading zero byte (GHSA-848j-6mx2-7j84); a faulty and a
 * correct signature of the same hash would expose the key. noble computes the nonce correctly.
 *
 * The output is what VeChain expects and thor-devkit made: r (32) || s (32) || recovery (1),
 * with a low s.
 */
export function signHash(msgHash: Uint8Array, privateKey: Uint8Array): Buffer {
    if (msgHash.length !== 32) throw new Error('invalid message hash')
    if (privateKey.length !== 32 || !secp256k1.utils.isValidPrivateKey(privateKey)) throw new Error('invalid private key')
    const sig = secp256k1.sign(msgHash, privateKey, { lowS: true })
    const out = Buffer.alloc(65)
    out.set(sig.toCompactRawBytes(), 0)
    out[64] = sig.recovery
    return out
}
