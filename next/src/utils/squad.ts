import { abi } from 'thor-devkit'

/**
 * Who holds at least 10 million SQUAD (Squirtle Squad, from VeChain's token registry): their avatar
 * wears the squad's sunglasses. Many avatars show at once, so lookups made within a moment go out as one dry run,
 * and answers are kept for six hours on this device.
 */

export const SQUAD = '0xb27a1fb87935b85cdaa2e16468247278c74c5ec7'
const TTL = 6 * 3600 * 1000
// the answers depend on the threshold: a new key when it changes
const KEY = 'bv-squad-10m'
const BATCH = 50
/** 10,000,000 SQUAD (18 decimals) */
export const MIN_SQUAD = 10_000_000n * 10n ** 18n

const balanceOf = new abi.Function({
    type: 'function', name: 'balanceOf', constant: true, payable: false, stateMutability: 'view',
    inputs: [{ type: 'address', name: 'owner' }], outputs: [{ type: 'uint256', name: 'balance' }]
})

type Entry = { at: number, holds: boolean }
let known: Record<string, Entry> | null = null

function store(): Record<string, Entry> {
    if (!known) {
        try {
            known = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Entry>
        } catch {
            known = {}
        }
    }
    return known
}

function save() {
    try {
        const now = Date.now()
        // what is still fresh, at most a few thousand addresses
        const fresh = Object.entries(store()).filter(([, e]) => now - e.at < TTL).slice(-3000)
        known = Object.fromEntries(fresh)
        localStorage.setItem(KEY, JSON.stringify(known))
    } catch { }
}

/** a known answer, or undefined when it has to be looked up */
export function knownHolder(address: string, now = Date.now()): boolean | undefined {
    const e = store()[address.toLowerCase()]
    return e && now - e.at < TTL ? e.holds : undefined
}

export function rememberHolder(address: string, holds: boolean, now = Date.now()) {
    store()[address.toLowerCase()] = { at: now, holds }
}

let pending: { thor: Connex.Thor, waiting: Map<string, ((v: boolean) => void)[]> } | null = null

async function flush(thor: Connex.Thor, waiting: Map<string, ((v: boolean) => void)[]>) {
    const addresses = [...waiting.keys()]
    for (let i = 0; i < addresses.length; i += BATCH) {
        const chunk = addresses.slice(i, i + BATCH)
        let out: { data: string, reverted: boolean }[] = []
        try {
            out = await thor.explain(chunk.map(a => ({ to: SQUAD, value: 0, data: balanceOf.encode(a) }))).execute()
        } catch { }
        chunk.forEach((a, k) => {
            const o = out[k]
            let holds = false
            try {
                holds = !!o && !o.reverted && BigInt(o.data) >= MIN_SQUAD
            } catch { }
            // a failed lookup isn't remembered: next time asks again
            if (o) rememberHolder(a, holds)
            for (const done of waiting.get(a) || []) done(holds)
        })
    }
    save()
}

/** whether the address holds at least MIN_SQUAD */
export function holdsSquad(thor: Connex.Thor, address: string): Promise<boolean> {
    const a = address.toLowerCase()
    const k = knownHolder(a)
    if (k !== undefined) return Promise.resolve(k)
    return new Promise(resolve => {
        if (!pending) {
            const batch = { thor, waiting: new Map<string, ((v: boolean) => void)[]>() }
            pending = batch
            setTimeout(() => {
                pending = null
                void flush(batch.thor, batch.waiting)
            }, 250)
        }
        const list = pending.waiting.get(a) || []
        list.push(resolve)
        pending.waiting.set(a, list)
    })
}
