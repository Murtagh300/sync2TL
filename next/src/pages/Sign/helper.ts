import { abi, Transaction } from 'thor-devkit'
import { abis } from 'src/consts'
import { BigNumber } from 'bignumber.js'

const paramsCache: Record<string, string> = {}

async function getBaseGasPrice(thor: Connex.Thor) {
    const baseGasPrice = '0x000000000000000000000000000000000000626173652d6761732d7072696365'
    const k = `${thor.genesis.id}-${baseGasPrice}`
    if (paramsCache[k]) {
        return paramsCache[k]
    } else {
        const address = '0x0000000000000000000000000000506172616d73'
        const result = await thor
            .account(address)
            .method(abis.paramsGet)
            .cache([address])
            .call(baseGasPrice)

        paramsCache[k] = result.data
        return result.data
    }
}

export type EstimateGasResult = {
    caller: string
    gas: number
    reverted: boolean
    revertReason: string
    vmError: string
    baseGasPrice: string
    /** the dry run, for what the transaction does to balances */
    outputs: Connex.VM.Output[]
}

export async function estimateGas(
    thor: Connex.Thor,
    clauses: Connex.VM.Clause[],
    suggestedGas: number,
    caller: string,
    gasPayer?: string
): Promise<EstimateGasResult> {
    const intrinsicGas = Transaction.intrinsicGas(clauses.map(item => {
        return {
            to: item.to,
            value: item.value || 0,
            data: item.data || '0x'
        }
    }))
    const offeredGas = suggestedGas ? Math.max(suggestedGas - intrinsicGas, 1) : 2000 * 10000
    const explainer = thor.explain(clauses)
        .caller(caller)
        .gas(offeredGas)

    if (gasPayer) {
        explainer.gasPayer(gasPayer)
    }

    const outputs = await explainer.execute()

    let gas = suggestedGas
    if (!gas) {
        const execGas = outputs.reduce((sum, out) => sum + out.gasUsed, 0)
        gas = intrinsicGas + (execGas ? (execGas + 15000) : 0)
    }

    const bgp = await getBaseGasPrice(thor)
    const lastOutput = outputs.slice().pop()
    return {
        caller,
        gas,
        reverted: lastOutput ? lastOutput.reverted : false,
        revertReason: lastOutput ? (lastOutput.revertReason || '') : '',
        vmError: lastOutput ? lastOutput.vmError : '',
        baseGasPrice: bgp,
        outputs
    }
}

export function calcFee(gas: number, baseGasPrice: string, gasPriceCoef: number) {
    return new BigNumber(baseGasPrice)
        .times(gasPriceCoef)
        .idiv(255)
        .plus(baseGasPrice)
        .times(gas)
}

const TRANSFER_SIG = new abi.Function(abis.transfer).signature

export function decodeAsTokenTransferClause(clause: Connex.VM.Clause, spec: M.TokenSpec): { to: string, amount: string } | null {
    let { data, to } = clause
    data = data || ''
    to = to && to.toLowerCase()

    if (to === spec.address && data.startsWith(TRANSFER_SIG)) {
        try {
            const decoded = abi.decodeParameters(abis.transfer.inputs, '0x' + data.slice(TRANSFER_SIG.length))
            return {
                to: decoded._to,
                amount: decoded._value
            }
        } catch { }
    }
    return null
}

// ERC-721 / ERC-1155 transfers, by function selector
const nftTransfers: Record<string, abi.Function> = {
    // ERC-721 transferFrom(from, to, tokenId) (ERC-20 shares it: token contracts are matched before this)
    '0x23b872dd': new abi.Function({ constant: false, inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], name: 'transferFrom', outputs: [], payable: false, stateMutability: 'nonpayable', type: 'function' }),
    // ERC-721 safeTransferFrom(from, to, tokenId)
    '0x42842e0e': new abi.Function({ constant: false, inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], name: 'safeTransferFrom', outputs: [], payable: false, stateMutability: 'nonpayable', type: 'function' }),
    // ERC-721 safeTransferFrom(from, to, tokenId, data)
    '0xb88d4fde': new abi.Function({ constant: false, inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'data', type: 'bytes' }], name: 'safeTransferFrom', outputs: [], payable: false, stateMutability: 'nonpayable', type: 'function' }),
    // ERC-1155 safeTransferFrom(from, to, id, amount, data)
    '0xf242432a': new abi.Function({ constant: false, inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'id', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'data', type: 'bytes' }], name: 'safeTransferFrom', outputs: [], payable: false, stateMutability: 'nonpayable', type: 'function' })
}

/** the NFT and recipient of an NFT transfer clause, or null */
export function decodeAsNftTransferClause(clause: Connex.VM.Clause): { tokenId: string, to: string, amount?: string } | null {
    const data = clause.data || ''
    const fn = nftTransfers[data.slice(0, 10).toLowerCase()]
    if (!fn) {
        return null
    }
    try {
        // the call's arguments (Function.decode reads return values, not arguments)
        const d = abi.decodeParameters(fn.definition.inputs, '0x' + data.slice(10))
        return {
            to: d.to as string,
            tokenId: String(d.tokenId ?? d.id),
            ...(d.amount !== undefined ? { amount: String(d.amount) } : {})
        }
    } catch {
        return null
    }
}
