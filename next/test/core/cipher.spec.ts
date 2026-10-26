import { describe, expect, it } from 'vitest'
import { Pbkdf2HmacSha256 } from 'asmcrypto.js/dist_es8/pbkdf2/pbkdf2-hmac-sha256'
import { decrypt, encrypt, kdfDecrypt, kdfEncrypt, secureRNG } from 'core/vault'
import { TEST_KDF_N } from '../stubs/vault-worker'
import * as fx from '../fixtures'

const key = Buffer.from(fx.cipher.key, 'hex')

describe('cipher', () => {
    it('decrypts a glob produced by an earlier version', () => {
        expect(decrypt(fx.cipher.glob, key).toString('utf8')).toBe(fx.words)
    })

    it('round-trips encrypt/decrypt with a fresh iv', () => {
        const clear = Buffer.from('some secret', 'utf8')
        const a = encrypt(clear, key)
        const b = encrypt(clear, key)
        expect(a.iv).not.toBe(b.iv)
        expect(decrypt(a, key)).toEqual(clear)
    })

    it('rejects a wrong key or tampered data by MAC', () => {
        const wrong = Buffer.from(key)
        wrong[31]! ^= 1
        expect(() => decrypt(fx.cipher.glob, wrong)).toThrow(/MAC mismatch/)

        const tampered = { ...fx.cipher.glob, cipherText: 'ff' + fx.cipher.glob.cipherText.slice(2) }
        expect(() => decrypt(tampered, key)).toThrow(/MAC mismatch/)
    })
})

describe('kdf', () => {
    it('uses PBKDF2-HMAC-SHA256 with a 32 byte output', () => {
        const out = Pbkdf2HmacSha256(
            Buffer.from(fx.kdf.password, 'utf8'),
            Buffer.from(fx.kdf.glob.kdf.salt, 'hex'),
            fx.kdf.glob.kdf.n,
            32
        )
        expect(Buffer.from(out).toString('hex')).toBe(fx.kdf.key)
    })

    it('decrypts a password glob produced by an earlier version', async () => {
        const clear = await kdfDecrypt(fx.kdf.glob, fx.kdf.password)
        expect(clear.toString('utf8')).toBe(fx.kdf.clear)
    })

    it('rejects a wrong password', async () => {
        await expect(kdfDecrypt(fx.kdf.glob, 'wrong password')).rejects.toThrow(/MAC mismatch/)
    })

    it('round-trips kdfEncrypt/kdfDecrypt and stores salt and iterations', async () => {
        const glob = await kdfEncrypt(Buffer.from('payload', 'utf8'), 'pw')
        expect(glob.kdf.n).toBe(TEST_KDF_N)
        expect(glob.kdf.salt).toHaveLength(64)
        expect((await kdfDecrypt(glob, 'pw')).toString('utf8')).toBe('payload')
    })
})

describe('secureRNG', () => {
    it('returns the requested number of bytes', async () => {
        expect(await secureRNG(16)).toHaveLength(16)
        expect(await secureRNG(32)).toHaveLength(32)
    })

    it('refuses more than 32 bytes', async () => {
        await expect(secureRNG(33)).rejects.toThrow()
    })
})
