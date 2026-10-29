import { reactive } from 'vue'
import { fn, contractName } from './actions'
import { knownLabel } from './known-labels'

/**
 * Names for addresses, wherever an address is shown: the user's contacts first,
 * then the .vet name it set (vet.domains, mainnet), then a public name for a well-known
 * contract (utils/known-labels.ts). Lookups are batched and cached.
 */

export type Contact = { name: string, address: string, /** labels such as family or team */ groups?: string[] }

// vet.domains resolve utility on mainnet
const RESOLVER = '0xA11413086e163e41901bb81fdc5617c975Fa5a1A'
const getAddresses = fn('getAddresses', [['string[]', 'names']], [['address[]', 'addresses']])
const getNames = fn('getNames', [['address[]', 'addresses']], [['string[]', 'names']])

const state = reactive({
    contacts: {} as Record<string, string>,
    // '' once looked up and none set
    vet: {} as Record<string, string>
})

let mainThor: (() => Connex.Thor | null) = () => null
const queue = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null

export function configureNames(thor: () => Connex.Thor | null) {
    mainThor = thor
}

export function setContacts(list: Contact[]) {
    state.contacts = Object.fromEntries(list.map(c => [c.address.toLowerCase(), c.name]))
}

async function flush() {
    timer = null
    const thor = mainThor()
    const batch = [...queue].slice(0, 40)
    batch.forEach(a => queue.delete(a))
    if (!thor || batch.length === 0) {
        return
    }
    try {
        const [out] = await thor.explain([{ to: RESOLVER, value: 0, data: getNames.encode(batch) }]).execute()
        const names: string[] = out && !out.reverted ? getNames.decode(out.data).names : []
        batch.forEach((a, i) => { state.vet[a] = names[i] || '' })
    } catch {
        // offline: try again on a later lookup
    }
    if (queue.size) {
        timer = setTimeout(() => void flush(), 30)
    }
}

/** the contact name or .vet name of an address; '' while unknown (reactive) */
export function nameOf(address: string | null | undefined): string {
    const a = (address || '').toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(a)) {
        return ''
    }
    if (state.contacts[a]) {
        return state.contacts[a]!
    }
    if (!(a in state.vet) && !queue.has(a)) {
        queue.add(a)
        timer = timer || setTimeout(() => void flush(), 30)
    }
    return state.vet[a] || contractName(a) || knownLabel(a)
}

export function isVetName(text: string) {
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.vet$/i.test(text.trim())
}

/** the address a .vet name points to, or null when it points nowhere */
export async function resolveVetName(name: string): Promise<string | null> {
    const thor = mainThor()
    if (!thor) {
        return null
    }
    const [out] = await thor.explain([{ to: RESOLVER, value: 0, data: getAddresses.encode([name.trim().toLowerCase()]) }]).execute()
    if (!out || out.reverted) {
        return null
    }
    const addr: string = getAddresses.decode(out.data).addresses[0] || ''
    if (!addr || /^0x0{40}$/i.test(addr)) {
        return null
    }
    state.vet[addr.toLowerCase()] = name.trim().toLowerCase()
    return addr
}
