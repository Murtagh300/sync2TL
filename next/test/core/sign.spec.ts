import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { secp256k1, address, Transaction, blake2b256 } from 'thor-devkit'
import { signHash } from 'src/core/sign'

// the signatures VeChain checks: the same as thor-devkit's, recoverable to the signer
describe('signing (noble)', () => {
    it('matches thor-devkit and recovers to the signer', () => {
        let same = 0
        for (let i = 0; i < 300; i++) {
            const sk = secp256k1.generatePrivateKey()
            const hash = blake2b256(randomBytes(64))
            const sig = signHash(hash, sk)
            expect(sig.length).toBe(65)
            expect(sig[64]).toBeLessThanOrEqual(1)
            expect(address.fromPublicKey(secp256k1.recover(hash, sig))).toBe(address.fromPublicKey(secp256k1.derivePublicKey(sk)))
            // deterministic (RFC 6979): the same as thor-devkit, apart from elliptic's rare faulty case
            if (sig.equals(secp256k1.sign(hash, sk))) same++
            // and the same every time
            expect(signHash(hash, sk).equals(sig)).toBe(true)
        }
        expect(same).toBeGreaterThanOrEqual(295)
    })

    it('signs a transaction the chain accepts', () => {
        const sk = secp256k1.generatePrivateKey()
        const tx = new Transaction({
            chainTag: 0x4a, blockRef: '0x0000000000000000', expiration: 32,
            clauses: [{ to: '0x7567d83b7b8d80addcb281a71d54fc7b3364ffed', value: 1, data: '0x' }],
            gasPriceCoef: 0, gas: 21000, dependsOn: null, nonce: 1
        })
        tx.signature = signHash(tx.signingHash(), sk)
        expect(tx.origin).toBe(address.fromPublicKey(secp256k1.derivePublicKey(sk)))
    })

    it('refuses bad input', () => {
        expect(() => signHash(new Uint8Array(31), secp256k1.generatePrivateKey())).toThrow(/hash/)
        expect(() => signHash(new Uint8Array(32), new Uint8Array(32))).toThrow(/private key/)
    })
})
