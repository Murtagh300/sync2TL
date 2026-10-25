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
})
