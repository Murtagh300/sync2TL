import { describe, expect, it } from 'vitest'
import { secp256k1 } from 'thor-devkit'
import { decryptMessage, encryptMessage, isMessageData } from 'src/utils/message-crypto'

describe('payment messages', () => {
    const recipient = secp256k1.generatePrivateKey()
    const sender = secp256k1.generatePrivateKey()
    const stranger = secp256k1.generatePrivateKey()

    it('can be read by the recipient and the sender, not by others', async () => {
        const data = await encryptMessage('Pizza 🍕, thanks!', [secp256k1.derivePublicKey(recipient), secp256k1.derivePublicKey(sender)])
        expect(isMessageData(data)).toBe(true)
        expect(await decryptMessage(data, recipient)).toBe('Pizza 🍕, thanks!')
        expect(await decryptMessage(data, sender)).toBe('Pizza 🍕, thanks!')
        expect(await decryptMessage(data, stranger)).toBeNull()
    })

    it('is cut at 200 characters', async () => {
        const data = await encryptMessage('x'.repeat(500), [secp256k1.derivePublicKey(recipient)])
        expect((await decryptMessage(data, recipient))!.length).toBe(200)
    })

    it('refuses an ephemeral key that is not on the curve', async () => {
        const data = await encryptMessage('hi', [secp256k1.derivePublicKey(recipient)])
        // "BVMSG1" is 6 bytes: the key's last byte sits at 6 + 64
        const at = 2 + (6 + 64) * 2
        const flipped = (parseInt(data.slice(at, at + 2), 16) ^ 1).toString(16).padStart(2, '0')
        await expect(decryptMessage(data.slice(0, at) + flipped + data.slice(at + 2), recipient)).rejects.toThrow()
    })
})
