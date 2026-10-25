import { address } from 'thor-devkit'
import { fns } from './actions'
import { toWei } from './format'

/**
 * Pay many addresses at once (airdrops, rewards, splitting a bill): a list of
 * "address, amount" lines, paid in one transaction per batch of clauses.
 */

/** clauses per transaction: well inside the block gas limit for token transfers */
export const BATCH_SIZE = 100

export type PayoutRow = {
    line: number
    /** an address, or a .vet name until it is resolved */
    to: string
    amount: string
    note: string
}

export type PayoutError = { line: number, key: 'address' | 'amount' }

/** "0xabc…, 12.5, thanks" per line; separators: comma, semicolon or tab */
export function parsePayout(text: string): { rows: PayoutRow[], errors: PayoutError[] } {
    const rows: PayoutRow[] = []
    const errors: PayoutError[] = []
    text.split(/\r?\n/).forEach((raw, i) => {
        const line = i + 1
        const trimmed = raw.trim()
        if (!trimmed || trimmed.startsWith('#')) {
            return
        }
        // with ; or tab between columns, a comma may be a decimal comma
        const parts = /[;\t]/.test(trimmed) ? trimmed.split(/[;\t]/) : trimmed.split(',')
        const [first = '', second = '', ...rest] = parts.map(p => p.trim())
        const to = first.replace(/^["']|["']$/g, '')
        const amount = second.replace(/^["']|["']$/g, '').replace(',', '.').replace(/\s/g, '')
        const isAddress = /^0x[0-9a-f]{40}$/i.test(to)
        const isName = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.vet$/i.test(to)
        if (!isAddress && !isName) {
            // a header row ("address,amount") is fine on the first line
            if (rows.length === 0 && errors.length === 0 && !/^0x/i.test(to) && !/^\d/.test(amount)) {
                return
            }
            errors.push({ line, key: 'address' })
            return
        }
        if (isAddress && to !== to.toLowerCase() && to.slice(2) !== to.slice(2).toUpperCase() && address.toChecksumed(to) !== to) {
            // mixed case that isn't a valid checksum: a typo
            errors.push({ line, key: 'address' })
            return
        }
        if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
            errors.push({ line, key: 'amount' })
            return
        }
        rows.push({ line, to, amount, note: rest.join(', ').replace(/^["']|["']$/g, '') })
    })
    return { rows, errors }
}

/** the sum of the amounts, in the token's smallest unit */
export function payoutTotal(rows: PayoutRow[], decimals: number): bigint {
    return rows.reduce((sum, r) => sum + BigInt(toWei(r.amount, decimals)), 0n)
}

export type PayoutClause = { to: string, value: string, data: string, comment: string }

/** transfer clauses (rows must have addresses by now), split into transactions */
export function payoutBatches(rows: PayoutRow[], token: { address?: string, decimals: number, symbol: string }): PayoutClause[][] {
    const clauses = rows.map<PayoutClause>(r => {
        const wei = toWei(r.amount, token.decimals)
        const comment = r.note || `${r.amount} ${token.symbol}`
        return token.address
            ? { to: token.address, value: '0', data: fns.transfer.encode(r.to, wei), comment }
            : { to: r.to, value: wei, data: '0x', comment }
    })
    const batches: PayoutClause[][] = []
    for (let i = 0; i < clauses.length; i += BATCH_SIZE) {
        batches.push(clauses.slice(i, i + BATCH_SIZE))
    }
    return batches
}

/** an NFT airdrop line: an address, and which token (none: the next one that is free) */
export type NftPayoutRow = { line: number, to: string, tokenId: string | null }
export type OwnedNft = { contract: string, tokenId: string, listed?: boolean, tokenStandard?: string }

/** "0xabc…, 42" or just "0xabc…" per line */
export function parseNftPayout(text: string): { rows: NftPayoutRow[], errors: PayoutError[] } {
    const rows: NftPayoutRow[] = []
    const errors: PayoutError[] = []
    text.split(/\r?\n/).forEach((raw, i) => {
        const line = i + 1
        const trimmed = raw.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const [first = '', second = ''] = trimmed.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''))
        const isAddress = /^0x[0-9a-f]{40}$/i.test(first)
        const isName = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.vet$/i.test(first)
        if (!isAddress && !isName) {
            if (rows.length === 0 && errors.length === 0 && !/^0x/i.test(first)) return // a header
            errors.push({ line, key: 'address' })
            return
        }
        if (second && !/^\d+$/.test(second)) {
            errors.push({ line, key: 'amount' })
            return
        }
        rows.push({ line, to: first, tokenId: second || null })
    })
    return { rows, errors }
}

/**
 * which NFT goes to each line: the one it names, or the next free one in order. Listed NFTs
 * can't move (the market holds them), and an NFT goes out once.
 */
export function assignNfts(rows: NftPayoutRow[], owned: OwnedNft[]): { pairs: { row: NftPayoutRow, nft: OwnedNft }[], missing: number[] } {
    const free = owned.filter(n => !n.listed)
    const used = new Set<string>()
    const named = new Set(rows.filter(r => r.tokenId).map(r => r.tokenId!))
    const pairs: { row: NftPayoutRow, nft: OwnedNft }[] = []
    const missing: number[] = []
    for (const row of rows) {
        let nft: OwnedNft | undefined
        if (row.tokenId) {
            nft = used.has(row.tokenId) ? undefined : free.find(n => n.tokenId === row.tokenId)
        } else {
            // the next free one that no other line asked for by number
            nft = free.find(n => !used.has(n.tokenId) && !named.has(n.tokenId))
        }
        if (nft) {
            used.add(nft.tokenId)
            pairs.push({ row, nft })
        } else {
            missing.push(row.line)
        }
    }
    return { pairs, missing }
}

/** addresses that appear on more than one line (lower case) */
export function duplicates(rows: PayoutRow[]): Set<string> {
    const seen = new Set<string>()
    const dup = new Set<string>()
    for (const r of rows) {
        const a = r.to.toLowerCase()
        if (seen.has(a)) dup.add(a)
        seen.add(a)
    }
    return dup
}
