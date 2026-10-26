import { describe, expect, it } from 'vitest'
import { Vault } from 'core/vault'
import * as fx from '../fixtures'

const key = Buffer.from(fx.cipher.key, 'hex')
const words = fx.words.split(' ')

describe('HD vault', () => {
    it('derives the standard VeChain addresses and keys', () => {
        const vault = Vault.createHD(words, key)
        for (const n of fx.hd.nodes) {
            const node = vault.derive(n.index)
            expect(node.index).toBe(n.index)
            expect(node.address.toLowerCase()).toBe(n.address)
            expect(node.unlock(key).toString('hex')).toBe(n.privateKey)
        }
    })

    it('opens a vault as stored by an earlier version', () => {
        // this is the shape kept in the wallets table
        const stored = JSON.stringify({
            pub: fx.hd.pub,
            chainCode: fx.hd.chainCode,
            cipherGlob: JSON.stringify(fx.cipher.glob),
            path: fx.hd.path
        })
        const vault = Vault.decode(stored)
        for (const n of fx.hd.nodes) {
            const node = vault.derive(n.index)
            expect(node.address.toLowerCase()).toBe(n.address)
            expect(node.unlock(key).toString('hex')).toBe(n.privateKey)
        }
        expect(vault.decrypt(key).toString('utf8')).toBe(fx.words)
    })

    it('survives encode/decode', () => {
        const vault = Vault.decode(Vault.createHD(words, key).encode())
        expect(vault.derive(0).address.toLowerCase()).toBe(fx.hd.nodes[0]!.address)
    })

    it('rejects a wrong key on unlock', () => {
        const wrong = Buffer.alloc(32, 7)
        expect(() => Vault.createHD(words, key).derive(0).unlock(wrong)).toThrow()
    })
})

describe('static key vault', () => {
    const sk = Buffer.from(fx.staticKey.sk, 'hex')

    it('exposes a single address and unlocks to the private key', () => {
        const vault = Vault.decode(Vault.createStatic(sk, key).encode())
        const node = vault.derive(0)
        expect(node.address.toLowerCase()).toBe(fx.staticKey.address)
        expect(node.unlock(key).toString('hex')).toBe(fx.staticKey.sk)
    })

    it('has no other indexes', () => {
        expect(() => Vault.createStatic(sk, key).derive(1)).toThrow(/invalid node index/)
    })
})

describe('USB (Ledger) vault', () => {
    it('derives addresses but holds no secret', () => {
        const vault = Vault.createUSB(Buffer.from(fx.hd.pub, 'hex'), Buffer.from(fx.hd.chainCode, 'hex'))
        expect(vault.derive(1).address.toLowerCase()).toBe(fx.hd.nodes[1]!.address)
        expect(() => vault.decrypt(key)).toThrow(/unsupported/)
    })
})

describe('mnemonic generation', () => {
    it('produces 24 words from 32 bytes and 12 from 16', async () => {
        const w24 = await Vault.generateMnemonic()
        const w12 = await Vault.generateMnemonic(16)
        expect(w24).toHaveLength(24)
        expect(w12).toHaveLength(12)
        // the words must be usable for an HD vault
        expect(() => Vault.createHD(w24, key).derive(0)).not.toThrow()
    })

    it('rejects invalid entropy lengths', async () => {
        await expect(Vault.generateMnemonic(12)).rejects.toThrow(/invalid arg/)
        await expect(Vault.generateMnemonic(18)).rejects.toThrow(/invalid arg/)
        await expect(Vault.generateMnemonic(36)).rejects.toThrow(/invalid arg/)
    })
})
