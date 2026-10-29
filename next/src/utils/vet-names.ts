import { abi, keccak256 } from 'thor-devkit'

/**
 * Registering a .vet name (vet.domains, an ENS fork; contracts from docs.vet.domains, mainnet).
 * Two transactions, against front-running: commit a hash of the request, wait at least 10
 * seconds (at most a day), then register with the same request and the price in VET. The name
 * points to the owner (an address record) and, when asked, becomes the owner's primary name.
 * A commit in progress is kept here, so leaving the page halfway loses nothing.
 */

export const CONTROLLER = '0x07479f2710d16a0bacbe6c25b9b32447364c0a33'
export const PUBLIC_RESOLVER = '0xabac49445584c8b6c1472b030b1076ac3901d7cf'
export const YEAR = 31536000
/** the price follows VET's price: a little extra covers a move between quote and block (the rest comes back) */
const PRICE_MARGIN = 103n

const view = (name: string, inputs: abi.Function.Parameter[], outputs: abi.Function.Parameter[]) =>
    new abi.Function({ type: 'function', name, constant: true, payable: false, stateMutability: 'view', inputs, outputs })

const REQUEST: abi.Function.Parameter[] = [
    { type: 'string', name: 'name' }, { type: 'address', name: 'owner' }, { type: 'uint256', name: 'duration' },
    { type: 'bytes32', name: 'secret' }, { type: 'address', name: 'resolver' }, { type: 'bytes[]', name: 'data' },
    { type: 'bool', name: 'reverseRecord' }, { type: 'uint16', name: 'ownerControlledFuses' }
]

const f = {
    available: view('available', [{ type: 'string', name: 'name' }], [{ type: 'bool', name: 'available' }]),
    valid: view('valid', [{ type: 'string', name: 'name' }], [{ type: 'bool', name: 'valid' }]),
    rentPrice: view('rentPrice', [{ type: 'string', name: 'name' }, { type: 'uint256', name: 'duration' }],
        [{ type: 'tuple', name: 'price', components: [{ type: 'uint256', name: 'base' }, { type: 'uint256', name: 'premium' }] }]),
    makeCommitment: new abi.Function({ type: 'function', name: 'makeCommitment', constant: true, payable: false, stateMutability: 'pure', inputs: REQUEST, outputs: [{ type: 'bytes32', name: 'commitment' }] }),
    commit: new abi.Function({ type: 'function', name: 'commit', constant: false, payable: false, stateMutability: 'nonpayable', inputs: [{ type: 'bytes32', name: 'commitment' }], outputs: [] }),
    register: new abi.Function({ type: 'function', name: 'register', constant: false, payable: true, stateMutability: 'payable', inputs: REQUEST, outputs: [] }),
    setAddr: new abi.Function({ type: 'function', name: 'setAddr', constant: false, payable: false, stateMutability: 'nonpayable', inputs: [{ type: 'bytes32', name: 'node' }, { type: 'address', name: 'a' }], outputs: [] })
}

/** a label as vet.domains takes it: lower case, without ".vet"; '' when it can't be one */
export function cleanLabel(input: string): string {
    const l = input.trim().toLowerCase().replace(/\.vet$/, '')
    // one label, no dots or spaces; the contract checks the rest (length, characters)
    return /^[^\s.]+$/.test(l) ? l : ''
}

/** ENS namehash of "label.vet" */
export function namehash(name: string): string {
    let node = Buffer.alloc(32)
    for (const label of name.split('.').reverse()) {
        node = Buffer.from(keccak256(node, keccak256(label)))
    }
    return '0x' + node.toString('hex')
}

export type NameQuote = { label: string, valid: boolean, available: boolean, price: bigint }

export async function quoteName(thor: Connex.Thor, label: string, years: number): Promise<NameQuote> {
    const call = (fn: abi.Function, args: unknown[]) => ({ to: CONTROLLER, value: '0', data: fn.encode(...args) })
    const outs = await thor.explain([
        call(f.valid, [label]),
        call(f.available, [label]),
        call(f.rentPrice, [label, years * YEAR])
    ]).execute()
    const ok = (i: number) => outs[i] && !outs[i]!.reverted
    const valid = !!ok(0) && !!f.valid.decode(outs[0]!.data).valid
    const available = valid && !!ok(1) && !!f.available.decode(outs[1]!.data).available
    let price = 0n
    if (ok(2)) {
        const p = f.rentPrice.decode(outs[2]!.data).price as { base: string, premium: string }
        price = BigInt(p.base) + BigInt(p.premium)
    }
    return { label, valid, available, price }
}

export type Pending = {
    label: string
    owner: string
    years: number
    secret: string
    primary: boolean
    /** when the commit went out (ms) */
    committedAt: number
    txid: string
}

function request(p: Pending): unknown[] {
    const data = [f.setAddr.encode(namehash(`${p.label}.vet`), p.owner)]
    return [p.label, p.owner, p.years * YEAR, p.secret, PUBLIC_RESOLVER, data, p.primary, 0]
}

export function newSecret(): string {
    const b = new Uint8Array(32)
    globalThis.crypto.getRandomValues(b)
    return '0x' + Buffer.from(b).toString('hex')
}

/** the commitment the contract will check, worked out here as makeCommitment does (the name hashed first) */
export function commitClause(p: Pending): { to: string, value: string, data: string } {
    const [label, ...rest] = request(p)
    const types: abi.Function.Parameter[] = [{ type: 'bytes32', name: 'label' }, ...REQUEST.slice(1)]
    const encoded = abi.encodeParameters(types, ['0x' + keccak256(label as string).toString('hex'), ...rest])
    const commitment = '0x' + keccak256(Buffer.from(encoded.slice(2), 'hex')).toString('hex')
    return { to: CONTROLLER, value: '0', data: f.commit.encode(commitment) }
}

export function registerClause(p: Pending, price: bigint): { to: string, value: string, data: string } {
    return { to: CONTROLLER, value: (price * PRICE_MARGIN / 100n).toString(), data: f.register.encode(...request(p)) }
}

/** the commitment as the contract makes it, for a check against ours */
export function makeCommitmentCall(p: Pending): { to: string, value: string, data: string } {
    return { to: CONTROLLER, value: '0', data: f.makeCommitment.encode(...request(p)) }
}

const KEY = 'bv-vet-pending'

export function loadPending(): Pending | null {
    try {
        const p = JSON.parse(localStorage.getItem(KEY) || 'null') as Pending | null
        // a commit older than a day can't be used any more
        return p && Date.now() - p.committedAt < 86400 * 1000 ? p : null
    } catch {
        return null
    }
}

export function savePending(p: Pending | null) {
    try {
        if (p) localStorage.setItem(KEY, JSON.stringify(p))
        else localStorage.removeItem(KEY)
    } catch { }
}
