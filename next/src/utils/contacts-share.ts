import { address } from 'thor-devkit'
import type { Contact } from './names'

/**
 * Contacts as text for a QR code, to move an address book to another device:
 * "bvcontacts:1:" and JSON [[name, address], …]. Addresses are checked on the way in.
 */
const PREFIX = 'bvcontacts:1:'

export function encodeContacts(list: Contact[]): string {
    return PREFIX + JSON.stringify(list.map(c => [c.name.slice(0, 40), c.address.toLowerCase()]))
}

export function decodeContacts(text: string): Contact[] | null {
    if (!text.startsWith(PREFIX)) {
        return null
    }
    try {
        const rows = JSON.parse(text.slice(PREFIX.length)) as unknown
        if (!Array.isArray(rows)) {
            return null
        }
        return rows
            .filter((r): r is [string, string] => Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string' && address.test(r[1]))
            .map(([name, a]) => ({ name: name.slice(0, 40), address: address.toChecksumed(a) }))
    } catch {
        return null
    }
}
