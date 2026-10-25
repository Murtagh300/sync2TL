import { Action, contractName, UNLIMITED, ZERO_ADDRESS } from './actions'
import { formatUnits } from './format'

export type Risk = 'ok' | 'warn' | 'danger'

export type ActionText = {
    icon: string
    text: string
    /** a second line with the detail that matters for the decision */
    detail?: string
    risk: Risk
}

export type DescribeContext = {
    t: (key: string, params?: Record<string, unknown>) => string
    /** the token spec of a contract, when it is a known token */
    token: (address: string) => { symbol: string, decimals: number } | undefined
    /** the collection name of an NFT contract, when known */
    collection: (address: string) => string | undefined
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** a spender or operator by name, or its short address */
export function who(address: string) {
    return contractName(address) || short(address)
}

function money(ctx: DescribeContext, amount: bigint, paymentToken: string | null | undefined) {
    const addr = (paymentToken || ZERO_ADDRESS).toLowerCase()
    if (addr === ZERO_ADDRESS) {
        return `${formatUnits(amount, 18)} VET`
    }
    const spec = ctx.token(addr)
    return spec ? `${formatUnits(amount, spec.decimals)} ${spec.symbol}` : `${formatUnits(amount, 18)} (${short(addr)})`
}

function nftName(ctx: DescribeContext, contract: string | undefined, tokenId: string | undefined) {
    const col = contract ? ctx.collection(contract) : undefined
    return `${col || ctx.t('action.an_nft')}${tokenId ? ` #${tokenId}` : ''}`
}

/** a sentence for an action, with how careful the signer should be */
export function describeAction(a: Action, ctx: DescribeContext): ActionText {
    const { t } = ctx
    switch (a.kind) {
        case 'approve': {
            const spec = ctx.token(a.token)
            const spender = who(a.spender)
            const known = !!contractName(a.spender)
            if (!spec && a.amount < 2n ** 64n && ctx.collection(a.token)) {
                // ERC-721 approve(spender, tokenId)
                return { icon: 'o_key', text: t('action.approve_nft', { spender, nft: nftName(ctx, a.token, a.amount.toString()) }), risk: known ? 'ok' : 'warn' }
            }
            const symbol = spec ? spec.symbol : short(a.token)
            if (a.amount === 0n) {
                return { icon: 'o_key_off', text: t('action.revoke', { spender, symbol }), risk: 'ok' }
            }
            if (a.amount >= UNLIMITED) {
                return { icon: 'o_key', text: t('action.approve_unlimited', { spender, symbol }), detail: t('action.detail_unlimited'), risk: known ? 'warn' : 'danger' }
            }
            const amount = spec ? formatUnits(a.amount, spec.decimals) : a.amount.toString()
            return { icon: 'o_key', text: t('action.approve', { spender, amount, symbol }), risk: known ? 'ok' : 'warn' }
        }
        case 'approve-nft':
            return { icon: 'o_key', text: t('action.approve_nft', { spender: who(a.spender), nft: nftName(ctx, a.contract, a.tokenId) }), risk: 'ok' }
        case 'approve-all': {
            const collection = ctx.collection(a.contract) || short(a.contract)
            if (!a.approved) {
                return { icon: 'o_key_off', text: t('action.revoke_all', { operator: who(a.operator), collection }), risk: 'ok' }
            }
            const known = !!contractName(a.operator)
            return { icon: 'o_key', text: t('action.approve_all', { operator: who(a.operator), collection }), detail: t('action.detail_approve_all'), risk: known ? 'warn' : 'danger' }
        }
        case 'wrap':
            return { icon: 'o_swap_horiz', text: t('action.wrap', { amount: formatUnits(a.amount, 18) }), risk: 'ok' }
        case 'unwrap':
            return { icon: 'o_swap_horiz', text: t('action.unwrap', { amount: formatUnits(a.amount, 18) }), risk: 'ok' }
        case 'list':
            return { icon: 'o_sell', text: t('action.list', { nft: nftName(ctx, a.contract, a.tokenId), price: money(ctx, a.price, a.paymentToken) }), risk: 'ok' }
        case 'cancel-listing':
            return { icon: 'o_cancel', text: t('action.cancel_listing'), risk: 'ok' }
        case 'buy':
            return { icon: 'o_shopping_bag', text: t('action.buy'), risk: 'ok' }
        case 'offer':
            return { icon: 'o_local_offer', text: t('action.offer', { amount: money(ctx, a.amount, a.paymentToken), nft: nftName(ctx, a.contract, a.tokenId) }), risk: 'ok' }
        case 'accept-offer':
            return { icon: 'o_handshake', text: t('action.accept_offer', { nft: nftName(ctx, a.contract, a.tokenId) }), risk: 'ok' }
        case 'cancel-offer':
            return { icon: 'o_cancel', text: t('action.cancel_offer'), risk: 'ok' }
        case 'collection-offer':
            return { icon: 'o_local_offer', text: t('action.collection_offer', { amount: money(ctx, a.price, a.paymentToken), n: a.quantity, collection: ctx.collection(a.contract) || short(a.contract) }), risk: 'ok' }
        case 'mint':
            return { icon: 'o_auto_awesome', text: t('action.mint', { n: a.quantity, collection: ctx.collection(a.contract) || short(a.contract) }), risk: 'ok' }
        case 'message':
            return { icon: 'o_lock', text: t('action.message', { to: who(a.to) }), risk: 'ok' }
        case 'swap':
            return { icon: 'o_swap_vert', text: t('action.swap', { router: who(a.router) }), risk: 'ok' }
    }
}
