import type { Service } from 'boot/services'

/** addresses the wallet has dealt with: own addresses, contacts, recent recipients (lower case) */
async function knownAddresses(svc: Service, gid: string): Promise<string[]> {
    const [wallets, contacts, recent] = await Promise.all([
        svc.wallet.all(),
        svc.config.getContacts(),
        svc.config.getRecentRecipients(gid)
    ])
    return [
        ...wallets.flatMap(w => w.meta.addresses),
        ...contacts.map(c => c.address),
        ...recent
    ].map(a => a.toLowerCase())
}

/** whether the wallet has dealt with an address before */
export async function isKnownRecipient(svc: Service, gid: string, address: string): Promise<boolean> {
    return (await knownAddresses(svc, gid)).includes(address.toLowerCase())
}

/**
 * address poisoning: a scammer makes an address with the same start and end as one you
 * use, and hopes you copy it from your history. Returns the known address it imitates.
 */
export function lookalike(address: string, known: string[]): string | null {
    const a = address.toLowerCase()
    const edges = (x: string) => x.slice(2, 6) + x.slice(-4)
    return known.find(k => k !== a && edges(k) === edges(a)) || null
}

export async function findLookalike(svc: Service, gid: string, address: string): Promise<string | null> {
    return lookalike(address, await knownAddresses(svc, gid))
}

/** remember an address as a recipient, so it is not asked about again */
export async function rememberRecipient(svc: Service, gid: string, address: string) {
    const recent = await svc.config.getRecentRecipients(gid)
    const list = [address.toLowerCase(), ...recent.filter(r => r.toLowerCase() !== address.toLowerCase())].slice(0, 10)
    await svc.config.saveRecentRecipients(gid, list)
}
