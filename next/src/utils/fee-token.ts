/**
 * The fee in VET or B3TR instead of VTHO: VeChain's generic delegator (VIP-194), as VeWorld uses it.
 *
 * The transaction goes to the delegator unsigned, with the VIP-191 bit. It appends one clause that pays
 * it in the chosen token, sets the gas and a fresh nonce, signs as gas payer and hands the body back;
 * the wallet checks that body (verifyDelegated) and signs it. Nothing is swapped: the delegator pays
 * the VTHO itself. Mainnet only.
 */
import { abi, Transaction } from 'thor-devkit'
import { fns } from './actions'
import { createClient } from './net'
import { B3TR } from './ecosystem'

export type FeeToken = 'vtho' | 'vet' | 'b3tr'

export const DELEGATOR_URL = 'https://mainnet.delegator.vechain.org/api/v1/'

const http = createClient({ baseURL: DELEGATOR_URL, timeout: 15 * 1000 })

/** the fee in the token's own units (0.0373 means 0.0373 VET), and the gas the delegator counts on */
export type FeeQuote = { token: FeeToken, cost: number, gas: number }

type Clause = { to: string | null, value: string | number, data?: string }

export async function quoteFee(token: Exclude<FeeToken, 'vtho'>, signer: string, clauses: Clause[]): Promise<FeeQuote> {
    const resp = await http.post<{ estimatedGas: number, transactionCost: number }>(
        `estimate/clauses/${token}`,
        { signer, clauses: clauses.map(c => ({ to: c.to, value: '0x' + BigInt(c.value || 0).toString(16), data: c.data || '0x' })) },
        { params: { type: 'legacy' } }
    )
    const { estimatedGas, transactionCost } = resp.data
    if (!(transactionCost > 0) || !(estimatedGas > 0)) throw new Error('no fee quote')
    return { token, cost: transactionCost, gas: estimatedGas }
}

/** the account the delegator is paid to */
export async function depositAccount(token: Exclude<FeeToken, 'vtho'>): Promise<string> {
    const resp = await http.get<{ depositAccount: string }>(`deposit/account/${token}`)
    return resp.data.depositAccount.toLowerCase()
}

/** the delegator's body and its gas-payer signature */
export async function delegate(token: Exclude<FeeToken, 'vtho'>, tx: Transaction<Transaction.LegacyBody>, origin: string): Promise<{ tx: Transaction<Transaction.LegacyBody>, signature: Buffer }> {
    const resp = await http.post<{ raw: string, signature: string }>(`sign/transaction/${token}`, {
        raw: '0x' + tx.encode().toString('hex'),
        origin
    })
    const back = Transaction.decode(Buffer.from(resp.data.raw.replace(/^0x/, ''), 'hex'), true) as Transaction<Transaction.LegacyBody>
    return { tx: back, signature: Buffer.from(resp.data.signature.replace(/^0x/, ''), 'hex') }
}

const big = (v: string | number | undefined) => BigInt(v || 0)
const same = (a: string | null | undefined, b: string | null | undefined) => (a || '').toLowerCase() === (b || '').toLowerCase()

/**
 * What the delegator may change, and nothing else: one clause at the end that pays the deposit
 * account in the chosen token, no more than `maxFee` (wei), the gas and the nonce. Everything the
 * user saw stays as it was. Returns the fee taken (wei); throws when the body was tampered with.
 */
export function verifyDelegated(
    ours: Transaction.LegacyBody,
    back: Transaction.LegacyBody,
    opts: { token: Exclude<FeeToken, 'vtho'>, deposit: string, maxFee: bigint }
): bigint {
    const fail = (why: string): never => { throw new Error(`delegator changed the transaction: ${why}`) }
    if (back.chainTag !== ours.chainTag) fail('chainTag')
    if (back.blockRef !== ours.blockRef) fail('blockRef')
    if (back.expiration !== ours.expiration) fail('expiration')
    if (back.gasPriceCoef !== ours.gasPriceCoef) fail('gasPriceCoef')
    if ((back.dependsOn || null) !== (ours.dependsOn || null)) fail('dependsOn')
    if (((back.reserved?.features || 0) & 1) !== 1) fail('not delegated')
    if (back.clauses.length !== ours.clauses.length + 1) fail('clauses')
    ours.clauses.forEach((c, i) => {
        const b = back.clauses[i]!
        if (!same(b.to, c.to) || big(b.value) !== big(c.value) || (b.data || '0x').toLowerCase() !== (c.data || '0x').toLowerCase()) fail(`clause ${i}`)
    })
    // the gas covers at least what the user's clauses need
    if (Number(back.gas) < Number(ours.gas)) fail('gas')

    const pay = back.clauses[back.clauses.length - 1]!
    let fee: bigint
    if (opts.token === 'vet') {
        if (!same(pay.to, opts.deposit) || (pay.data || '0x') !== '0x') fail('fee clause')
        fee = big(pay.value)
    } else {
        if (!same(pay.to, B3TR) || big(pay.value) !== 0n) fail('fee clause')
        let args: abi.Decoded
        try {
            if (!(pay.data || '').toLowerCase().startsWith(fns.transfer.signature)) throw new Error()
            args = abi.decodeParameters(fns.transfer.definition.inputs, '0x' + pay.data.slice(10))
        } catch {
            return fail('fee clause')
        }
        if (!same(args.to as string, opts.deposit)) fail('fee clause')
        fee = BigInt(args.amount as string)
    }
    if (fee <= 0n || fee > opts.maxFee) fail('fee')
    return fee
}

/** a quote in wei, with room for the price to move between the quote and signing */
export function maxFeeWei(quote: FeeQuote): bigint {
    // three times the quote, at least a hundredth of a token: the fee is cents either way
    const cap = Math.max(quote.cost * 3, 0.01)
    return BigInt(Math.ceil(Number((cap * 1e9).toFixed(3)))) * 10n ** 9n
}
