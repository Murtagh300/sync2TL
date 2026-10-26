import { address } from 'thor-devkit'
import type { Contact } from './names'

/**
 * The address book as CSV: name, address, groups (groups separated by |). Spreadsheet apps
 * open it; a cell that starts like a formula gets a leading quote, as in the activity export.
 */

const cell = (raw: string) => {
    const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
    return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function contactsToCsv(list: Contact[]): string {
    return [
        'name,address,groups',
        ...list.map(c => [c.name, c.address, (c.groups || []).join('|')].map(cell).join(','))
    ].join('\n')
}

/** one CSV line into cells, with quoted cells ("a, b") and doubled quotes */
function cells(line: string): string[] {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
        const ch = line[i]!
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') quoted = false
            else cur += ch
        } else if (ch === '"') quoted = true
        else if (ch === ',' || ch === ';' || ch === '\t') { out.push(cur); cur = '' }
        else cur += ch
    }
    out.push(cur)
    return out.map(c => c.trim().replace(/^'(?=[=+\-@])/, ''))
}

/** contacts from CSV: a header is skipped; lines without a valid address are left out (counted) */
export function contactsFromCsv(text: string): { contacts: Contact[], skipped: number } {
    const contacts: Contact[] = []
    let skipped = 0
    for (const [i, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
        if (!raw.trim()) continue
        const [name = '', addr = '', groups = ''] = cells(raw)
        if (!address.test(addr)) {
            // the header, or a line that isn't a contact
            if (i > 0) skipped++
            continue
        }
        // a mixed-case address with a broken checksum is a typo
        if (addr !== addr.toLowerCase() && addr.slice(2) !== addr.slice(2).toUpperCase() && address.toChecksumed(addr) !== addr) {
            skipped++
            continue
        }
        const g = groups.split('|').map(s => s.trim()).filter(Boolean)
        contacts.push({ name: name || `${addr.slice(0, 6)}…${addr.slice(-4)}`, address: address.toChecksumed(addr), ...(g.length ? { groups: g } : {}) })
    }
    return { contacts, skipped }
}
