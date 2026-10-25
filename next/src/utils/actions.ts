import { abi } from 'thor-devkit'
import { KNOWN_MARKETS } from './known-markets'

/**
 * Reads what a clause does, in terms a person understands: "approve", "list an NFT",
 * "swap"... Used by the sign dialog (to explain before signing) and by the activity list.
 */

type Param = [type: string, name: string]

/** a function definition from a compact signature */
export function fn(name: string, inputs: Param[], outputs: Param[] = [], payable = false): abi.Function {
    return new abi.Function({
        type: 'function',
        name,
        constant: false,
        payable,
        stateMutability: payable ? 'payable' : 'nonpayable',
        inputs: inputs.map(([type, n]) => ({ type, name: n })),
        outputs: outputs.map(([type, n]) => ({ type, name: n }))
    })
}

export const fns = {
    // tokens
    transfer: fn('transfer', [['address', 'to'], ['uint256', 'amount']]),
    approve: fn('approve', [['address', 'spender'], ['uint256', 'amount']]),
    setApprovalForAll: fn('setApprovalForAll', [['address', 'operator'], ['bool', 'approved']]),
    allowance: fn('allowance', [['address', 'owner'], ['address', 'spender']], [['uint256', 'amount']]),
    isApprovedForAll: fn('isApprovedForAll', [['address', 'owner'], ['address', 'operator']], [['bool', 'approved']]),
    // NFTs
    transferFrom: fn('transferFrom', [['address', 'from'], ['address', 'to'], ['uint256', 'tokenId']]),
    safeTransferFrom721: fn('safeTransferFrom', [['address', 'from'], ['address', 'to'], ['uint256', 'tokenId']]),
    safeTransferFrom1155: fn('safeTransferFrom', [['address', 'from'], ['address', 'to'], ['uint256', 'id'], ['uint256', 'amount'], ['bytes', 'data']]),
    // VVET
    deposit: fn('deposit', [], [], true),
    withdraw: fn('withdraw', [['uint256', 'amount']]),
    // BlackVeMarket (the MAAS marketplace contract of each collection)
    createAuctionSale: fn('createAuctionSale', [['address', 'nft'], ['uint256', 'tokenId'], ['uint256', 'minPrice'], ['uint256', 'fixedPrice'], ['uint256', 'duration'], ['address', 'paymentToken']], [['uint256', 'saleId']]),
    createAuctionSale1155: fn('createAuctionSale1155', [['address', 'nft'], ['uint256', 'tokenId'], ['uint256', 'amount'], ['uint256', 'minPrice'], ['uint256', 'fixedPrice'], ['uint256', 'duration'], ['address', 'paymentToken']], [['uint256', 'saleId']]),
    cancelSale: fn('cancelSale', [['uint256', 'saleId']]),
    fixedBuy: fn('fixedBuy', [['uint256', 'saleId']], [], true),
    fixedBuy1155: fn('fixedBuy1155', [['uint256', 'saleId'], ['uint256', 'quantity']], [], true),
    createOffer: fn('createOffer', [['uint256', 'saleId'], ['uint256', 'amount'], ['address', 'paymentToken']]),
    createBlindOffer: fn('createBlindOffer', [['address', 'nft'], ['uint256', 'tokenId'], ['uint256', 'amount'], ['address', 'paymentToken']]),
    acceptOffer: fn('acceptOffer', [['uint256', 'saleId'], ['uint256', 'index']]),
    acceptBlindOffer: fn('acceptBlindOffer', [['address', 'nft'], ['uint256', 'tokenId'], ['uint256', 'index']]),
    cancelOffer: fn('cancelOffer', [['uint256', 'saleId'], ['uint256', 'index']]),
    cancelBlindOffer: fn('cancelBlindOffer', [['address', 'nft'], ['uint256', 'tokenId'], ['uint256', 'index']]),
    // BlackVeMarket offers contract: an offer on any NFT of a collection
    createCollectionOffer: fn('createOffer', [['address', 'nft'], ['address', 'paymentToken'], ['uint256', 'pricePerItem'], ['uint32', 'quantity'], ['uint64', 'expiresAt']], [['uint256', 'offerId']]),
    cancelCollectionOffer: fn('cancelOffer', [['uint256', 'offerId']]),
    acceptCollectionOffer: fn('acceptOffer', [['uint256', 'offerId'], ['uint256[]', 'tokenIds']]),
    // BlackVeMarket launchpad collections
    mint: fn('mint', [['uint256', 'phaseId'], ['uint32', 'quantity']], [], true),
    // Uniswap V2 style routers (VeRocket, BetterSwap aggregator)
    swapExactETHForTokens: fn('swapExactETHForTokens', [['uint256', 'amountOutMin'], ['address[]', 'path'], ['address', 'to'], ['uint256', 'deadline']], [], true),
    swapExactTokensForETH: fn('swapExactTokensForETH', [['uint256', 'amountIn'], ['uint256', 'amountOutMin'], ['address[]', 'path'], ['address', 'to'], ['uint256', 'deadline']]),
    swapExactTokensForTokens: fn('swapExactTokensForTokens', [['uint256', 'amountIn'], ['uint256', 'amountOutMin'], ['address[]', 'path'], ['address', 'to'], ['uint256', 'deadline']]),
    getAmountsOut: fn('getAmountsOut', [['uint256', 'amountIn'], ['address[]', 'path']], [['uint256[]', 'amounts']])
}

/** larger than any real balance: an "unlimited" approval */
export const UNLIMITED = 2n ** 128n

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export type Action =
    | { kind: 'approve', token: string, spender: string, amount: bigint }
    | { kind: 'approve-nft', contract: string, spender: string, tokenId: string }
    | { kind: 'approve-all', contract: string, operator: string, approved: boolean }
    | { kind: 'wrap', amount: bigint }
    | { kind: 'unwrap', amount: bigint }
    | { kind: 'list', market: string, contract: string, tokenId: string, price: bigint, paymentToken: string, amount?: string }
    | { kind: 'cancel-listing', market: string, saleId: string }
    | { kind: 'buy', market: string, saleId: string, quantity?: string }
    | { kind: 'offer', market: string, amount: bigint, paymentToken: string, saleId?: string, contract?: string, tokenId?: string }
    | { kind: 'accept-offer', market: string, saleId?: string, contract?: string, tokenId?: string }
    | { kind: 'cancel-offer', market: string }
    | { kind: 'collection-offer', market: string, contract: string, price: bigint, paymentToken: string, quantity: number }
    | { kind: 'mint', contract: string, phaseId: string, quantity: number }
    | { kind: 'swap', router: string }
    | { kind: 'message', to: string }

// by selector; transfer/transferFrom (shared by ERC-20 and ERC-721) are read by the token card
const table: Array<[abi.Function, (to: string, d: abi.Decoded) => Action | null]> = [
    [fns.approve, (to, d) => {
        // ERC-721 approve(to, tokenId) has the same selector: an amount that small is a token id only
        // when the contract is not a known token; the sign card resolves that with the registry
        return { kind: 'approve', token: to, spender: d.spender, amount: BigInt(d.amount) }
    }],
    [fns.setApprovalForAll, (to, d) => ({ kind: 'approve-all', contract: to, operator: d.operator, approved: !!d.approved })],
    [fns.deposit, () => null], // value carries the amount; filled below
    [fns.withdraw, (_to, d) => ({ kind: 'unwrap', amount: BigInt(d.amount) })],
    [fns.createAuctionSale, (to, d) => ({ kind: 'list', market: to, contract: d.nft, tokenId: String(d.tokenId), price: BigInt(d.fixedPrice), paymentToken: d.paymentToken })],
    [fns.createAuctionSale1155, (to, d) => ({ kind: 'list', market: to, contract: d.nft, tokenId: String(d.tokenId), price: BigInt(d.fixedPrice), paymentToken: d.paymentToken, amount: String(d.amount) })],
    [fns.cancelSale, (to, d) => ({ kind: 'cancel-listing', market: to, saleId: String(d.saleId) })],
    [fns.fixedBuy, (to, d) => ({ kind: 'buy', market: to, saleId: String(d.saleId) })],
    [fns.fixedBuy1155, (to, d) => ({ kind: 'buy', market: to, saleId: String(d.saleId), quantity: String(d.quantity) })],
    [fns.createOffer, (to, d) => ({ kind: 'offer', market: to, saleId: String(d.saleId), amount: BigInt(d.amount), paymentToken: d.paymentToken })],
    [fns.createBlindOffer, (to, d) => ({ kind: 'offer', market: to, contract: d.nft, tokenId: String(d.tokenId), amount: BigInt(d.amount), paymentToken: d.paymentToken })],
    [fns.acceptOffer, (to, d) => ({ kind: 'accept-offer', market: to, saleId: String(d.saleId) })],
    [fns.acceptBlindOffer, (to, d) => ({ kind: 'accept-offer', market: to, contract: d.nft, tokenId: String(d.tokenId) })],
    [fns.cancelOffer, (to) => ({ kind: 'cancel-offer', market: to })],
    [fns.cancelBlindOffer, (to) => ({ kind: 'cancel-offer', market: to })],
    [fns.createCollectionOffer, (to, d) => ({ kind: 'collection-offer', market: to, contract: d.nft, price: BigInt(d.pricePerItem), paymentToken: d.paymentToken, quantity: Number(d.quantity) })],
    [fns.cancelCollectionOffer, (to) => ({ kind: 'cancel-offer', market: to })],
    [fns.acceptCollectionOffer, (to) => ({ kind: 'accept-offer', market: to })],
    [fns.mint, (to, d) => ({ kind: 'mint', contract: to, phaseId: String(d.phaseId), quantity: Number(d.quantity) })],
    [fns.swapExactETHForTokens, (to) => ({ kind: 'swap', router: to })],
    [fns.swapExactTokensForETH, (to) => ({ kind: 'swap', router: to })],
    [fns.swapExactTokensForTokens, (to) => ({ kind: 'swap', router: to })]
]
const bySelector = new Map(table.map(([f, read]) => [f.signature, { f, read }]))

/** the action of a contract call, or null when it is not one we know */
export function decodeAction(clause: { to: string | null, value: string | number, data?: string }): Action | null {
    const data = (clause.data || '0x').toLowerCase()
    const to = (clause.to || '').toLowerCase()
    if (!to || data.length < 10) {
        return null
    }
    if (data.startsWith('0x42564d534731')) {
        // "BVMSG1": an encrypted payment message (src/utils/message-crypto.ts)
        return { kind: 'message', to }
    }
    const sel = data.slice(0, 10)
    if (sel === fns.deposit.signature) {
        return { kind: 'wrap', amount: BigInt(clause.value || 0) }
    }
    if (knownSwapRouters.has(to)) {
        return { kind: 'swap', router: to }
    }
    const entry = bySelector.get(sel)
    if (!entry) {
        return null
    }
    try {
        const d = abi.decodeParameters(entry.f.definition.inputs, '0x' + data.slice(10))
        return entry.read(to, d)
    } catch {
        return null
    }
}

// contracts people sign for, by address (lower case)
const names: Record<string, string> = {
    '0x45429a2255e7248e57fce99e7239aed3f84b7a53': 'VVET',
    '0x181efd5a9ad8d9c3c56cc5ce66a98d3bec82dd4c': 'BlackVeMarket Offers',
    '0x44510c3bf10b8597e51ff04542c287a63f2c967e': 'BlackVeMarket Raffles',
    '0xd747aa9ba03dd778f1452e45d0fbe3a682b644cd': 'VeTrade',
    '0x3bd339960f4c176119815b446a0278fb115e3e26': 'VeTrade',
    '0x4b3828afda370c95ac4dce3fde0b6d1f8fc0ce36': 'VeTrade',
    '0x23cbbf0265f55574490ab6eb1ed8730c71e23d6c': 'BetterSwap',
    '0x17d6282e6746aa25105624a9c97003a3997c64e9': 'BetterSwap',
    '0xda5a60c8559a37eab5950a4ace9b77c25f6fde80': 'BetterSwap',
    '0x07cf4ef7044f5f290e0fe066ee1067c75d5bc478': 'BetterSwap',
    '0x058acda40fe30be56f9ffe918f602d45e2b6d39d': 'BetterSwap',
    '0xca72aa1f4912789d294e467686250f7e634b28b8': 'BetterSwap',
    '0x343582e1e19d41c7942678616156e31db7b4e97a': 'BetterSwap',
    '0x576da7124c7bb65a692d95848276367e5a844d95': 'VeRocket',
    '0x6c0a6e1d922e0e63901301573370b932ae20dadb': 'Vexchange',
    '0xa11413086e163e41901bb81fdc5617c975fa5a1a': 'vet.domains'
}
const knownSwapRouters = new Set(Object.entries(names)
    .filter(([, n]) => ['VeTrade', 'BetterSwap', 'VeRocket', 'Vexchange'].includes(n))
    .map(([a]) => a))

/** a name for a contract, or '' when we don't know it */
export function contractName(address: string | null | undefined): string {
    const a = (address || '').toLowerCase()
    if (names[a]) {
        return names[a]
    }
    return KNOWN_MARKETS.has(a) ? 'BlackVeMarket' : ''
}

export function isKnownSwapRouter(address: string) {
    return knownSwapRouters.has(address.toLowerCase())
}
