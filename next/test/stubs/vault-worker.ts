// In-process stand-in for core/vault/worker.ts (Node has no web workers).
// Speaks the same [seq, cmd, args] -> [seq, result, err] protocol and uses the
// same PBKDF2 implementation; only the iteration estimate is kept small.
import { randomBytes } from 'node:crypto'
import { Pbkdf2HmacSha256 } from 'asmcrypto.js/dist_es8/pbkdf2/pbkdf2-hmac-sha256'

export const TEST_KDF_N = 1024

type Message = { data: unknown[] }

export default class VaultWorkerStub {
    onmessage: ((ev: Message) => void) | null = null

    postMessage([seq, cmd, args]: [number, string, unknown[]]) {
        Promise.resolve()
            .then(() => this.handle(cmd, args))
            .then(
                result => this.onmessage?.({ data: [seq, result] }),
                err => this.onmessage?.({ data: [seq, undefined, { message: (err as Error).message }] })
            )
    }

    private handle(cmd: string, args: unknown[]) {
        switch (cmd) {
            case 'secureRNG': {
                const [size] = args as [number]
                if (size > 32) {
                    throw new Error('secureRGN size should be <= 32')
                }
                return new Uint8Array(randomBytes(size))
            }
            case 'kdfEstimateN':
                return TEST_KDF_N
            case 'kdf': {
                const [password, salt, n] = args as [Uint8Array, Uint8Array, number]
                return Pbkdf2HmacSha256(password, salt, n, 32)
            }
            default:
                throw new Error(`worker: unexpected command '${cmd}'`)
        }
    }
}
