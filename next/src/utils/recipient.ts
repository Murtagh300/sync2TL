import type { Service } from 'boot/services'

/** whether the wallet has dealt with an address before: own addresses, contacts, recent recipients */
export async function isKnownRecipient(svc: Service, gid: string, address: string): Promise<boolean> {
    const a = address.toLowerCase()
    const [wallets, contacts, recent] = await Promise.all([
        svc.wallet.all(),
        svc.config.getContacts(),
        svc.config.getRecentRecipients(gid)
    ])
    return wallets.some(w => w.meta.addresses.some(x => x.toLowerCase() === a)) ||
        contacts.some(c => c.address.toLowerCase() === a) ||
        recent.some(r => r.toLowerCase() === a)
}

/** remember an address as a recipient, so it is not asked about again */
export async function rememberRecipient(svc: Service, gid: string, address: string) {
    const recent = await svc.config.getRecentRecipients(gid)
    const list = [address.toLowerCase(), ...recent.filter(r => r.toLowerCase() !== address.toLowerCase())].slice(0, 10)
    await svc.config.saveRecentRecipients(gid, list)
}
