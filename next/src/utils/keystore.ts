import { address as addr, Keystore } from 'thor-devkit'

/**
 * Keystore files (the Web3 secret storage format Sync, Sync2 and VeChainThor's tools read and
 * write): one private key, encrypted with a password (scrypt + AES). Import makes a key wallet;
 * export writes one address's key so another wallet can open it.
 */

export const MIN_KEYSTORE_PASSWORD = 8

/** the parsed file when it looks like a keystore, else null */
export function parseKeystore(text: string): Keystore | null {
    try {
        // trim() also drops a byte order mark
        const ks = JSON.parse(text.trim()) as Keystore
        return Keystore.wellFormed(ks) ? ks : null
    } catch {
        return null
    }
}

/** the address a keystore says it holds (checked again once decrypted) */
export function keystoreAddress(ks: Keystore): string {
    return addr.toChecksumed('0x' + ks.address.replace(/^0x/i, '').toLowerCase())
}

/** the private key in a keystore; throws on a wrong password */
export async function openKeystore(ks: Keystore, password: string): Promise<Buffer> {
    return Keystore.decrypt(ks, password)
}

/** a keystore file for a private key */
export async function makeKeystore(privateKey: Buffer, password: string): Promise<string> {
    return JSON.stringify(await Keystore.encrypt(privateKey, password))
}

/** the usual file name: UTC--<time>--<address> */
export function keystoreFileName(address: string, at = new Date()) {
    return `UTC--${at.toISOString().replace(/:/g, '-')}--${address.replace(/^0x/i, '').toLowerCase()}.json`
}

/** asks for a text file; '' when none was chosen */
export function pickTextFile(accept = '.json,application/json'): Promise<string> {
    return new Promise(resolve => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = accept
        input.onchange = () => {
            const file = input.files?.[0]
            if (!file || file.size > 64 * 1024) return resolve('')
            file.text().then(resolve, () => resolve(''))
        }
        input.click()
    })
}
