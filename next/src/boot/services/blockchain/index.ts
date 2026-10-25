import { abis } from 'src/consts'
import { createPool } from './pool'
import { commitTx } from './tx-commiter'
import { balanceKey, readSnapshot, writeSnapshot } from 'src/utils/snapshot'
function serve(gid: string, pool: ReturnType<typeof createPool>) {
    return {
        get thor() { return pool.get(gid).thor },
        /** the balance; the last one seen is kept for cachedBalance */
        balanceOf(addr: string, spec: M.TokenSpec): Promise<string> {
            return this.fetchBalance(addr, spec).then(v => {
                writeSnapshot(balanceKey(gid, addr, spec.symbol), v)
                return v
            })
        },
        /** the last balance seen, to show while the current one loads (or offline) */
        cachedBalance(addr: string, spec: M.TokenSpec): string | undefined {
            return readSnapshot<string>(balanceKey(gid, addr, spec.symbol))?.value
        },
        fetchBalance(addr: string, spec: M.TokenSpec): Promise<string> {
            if (spec.symbol === 'VET') {
                return this.thor.account(addr).get().then(a => a.balance)
            } else if (spec.symbol === 'VTHO') {
                return this.thor.account(addr).get().then(a => a.energy)
            } else {
                return this.thor.account(spec.address)
                    .method(abis.balanceOf)
                    .cache([addr])
                    .call(addr)
                    .then(output => output.decoded.balance)
            }
        },
        commitTx(raw: string) {
            commitTx(pool.resoleNode(gid).url, raw)
        }
    }
}

export function build(resolveNode: (gid: string) => M.Node) {
    const pool = createPool(resolveNode)
    const cache = new Map<string, ReturnType<typeof serve>>()
    return (gid: string) => {
        let handler = cache.get(gid)
        if (!handler) {
            cache.set(gid, handler = serve(gid, pool))
        }
        return handler
    }
}
