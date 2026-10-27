<script lang="ts">
import { defineComponent } from 'vue'
import { playChime } from 'src/utils/sound'
import { abis } from 'src/consts'
import { abi } from 'thor-devkit'
import { formatAmount } from 'src/utils/format'
import { emitBalancePulse, notify as addNotification } from 'src/utils/notifications'

export default defineComponent({
    props: {
        gid: { type: String, required: true }
    },
    computed: {
        thor(): Connex.Thor { return this.$svc.bc(this.gid).thor },
        // changes with each block; thor itself stays the same object, so watching it never fires
        head(): string { return this.$svc.bc(this.gid).thor.status.head.id },
        addresses(): string[] {
            if (!this.wallets) {
                return []
            }
            return Array.from(this.wallets.reduce<Set<string>>((prev, cur) => {
                cur.meta.addresses.forEach(a => prev.add(a))
                return prev
            }, new Set()))
        },
        // compose vet transfer criteria
        transferCriteria(): Connex.Thor.Filter.Criteria<'transfer'>[] {
            return this.addresses.reduce<Connex.Thor.Filter.Criteria<'transfer'>[]>((prev, cur) => {
                prev.push({ sender: cur }, { recipient: cur })
                return prev
            }, [])
        },
        // compose token transfer criteria
        eventCriteria(): Connex.Thor.Filter.Criteria<'event'>[] {
            const tokens = this.tokens
            if (!tokens) {
                return []
            }
            return this.addresses.reduce<Connex.Thor.Filter.Criteria<'event'>[]>((prev, cur) => {
                tokens.forEach(spec => {
                    const ev = this.thor
                        .account(spec.address)
                        .event(abis.transferEvent)
                    prev.push(
                        ev.asCriteria({ _from: cur }),
                        ev.asCriteria({ _to: cur }))
                })
                return prev
            }, [])
        }
    },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        wallets: null as M.Wallet[] | null,
        tokens: null as M.TokenSpec[] | null,
        transfers: null as Connex.Thor.Filter.Row<'transfer'>[] | null,
        events: null as Connex.Thor.Filter.Row<'event'>[] | null
    }),
    asyncComputed: {
        wallets(): Promise<M.Wallet[] | null> {
            return this.$svc.wallet.getByGid(this.gid)
        },
        async tokens(): Promise<M.TokenSpec[] | null> {
            const [tokens, activeSymbols] = await Promise.all([
                this.$svc.config.token.all(),
                this.$svc.config.token.activeSymbols()
            ])
            return tokens.filter(token =>
                token.address && // exclude vet
                token.gid === this.gid &&
                (activeSymbols.includes(token.symbol) || token.permanent))
        },
        // vet transfers
        transfers: {
            get(): Promise<Connex.Thor.Filter.Row<'transfer'>[] | null> {
                return this.guardRange('transfer', range => {
                    const criteria = this.transferCriteria
                    if (criteria.length === 0) {
                        return Promise.resolve([])
                    }

                    return this.thor.filter('transfer', criteria)
                        .cache(this.addresses)
                        .range(range)
                        .apply(0, 5)
                })
            },
            // no auto update, but react to headNumber change
            shouldUpdate() { return false }
        },
        // token transfers
        events: {
            get(): Promise<Connex.Thor.Filter.Row<'event'>[] | null> {
                return this.guardRange('event', range => {
                    const criteria = this.eventCriteria
                    if (criteria.length === 0) {
                        return Promise.resolve([])
                    }

                    return this.thor.filter('event', criteria)
                        .cache(this.addresses)
                        .range(range)
                        .apply(0, 5)
                })
            },
            // no auto update, but react to headNumber change
            shouldUpdate() { return false }
        }
    },
    watch: {
        head() {
            this.$asyncComputed.events?.update()
            this.$asyncComputed.transfers?.update()
        },
        transfers(newVal: Connex.Thor.Filter.Row<'transfer'>[] | null) {
            const wallets = this.wallets
            if (!wallets) {
                return
            }
            newVal && newVal.forEach(t => {
                let w = wallets.find(w => w.meta.addresses.includes(t.recipient))
                if (w) {
                    this.notify('in', t.amount, 18, 'VET', w.id, w.meta.addresses.indexOf(t.recipient))
                }
                w = wallets.find(w => w.meta.addresses.includes(t.sender))
                if (w) {
                    this.notify('out', t.amount, 18, 'VET', w.id, w.meta.addresses.indexOf(t.sender))
                }
            })
        },
        events(newVal: Connex.Thor.Filter.Row<'event'>[] | null) {
            const wallets = this.wallets
            const tokens = this.tokens
            if (!wallets || !tokens) {
                return
            }
            newVal && newVal.forEach(e => {
                const token = tokens.find(t => t.address === e.address)
                if (!token) {
                    return
                }
                const { _to = '', _from = '', _value = '0' }: Record<string, string> = new abi.Event(abis.transferEvent).decode(e.data, e.topics)
                let w = wallets.find(w => w.meta.addresses.includes(_to))
                if (w) {
                    this.notify('in', _value, token.decimals, token.symbol, w.id, w.meta.addresses.indexOf(_to))
                }
                w = wallets.find(w => w.meta.addresses.includes(_from))
                if (w) {
                    this.notify('out', _value, token.decimals, token.symbol, w.id, w.meta.addresses.indexOf(_from))
                }
            })
        }
    },
    methods: {
        // provides stored range for the query
        async guardRange<T extends Connex.Thor.Filter.WithMeta>(kind: string, query: (range: Connex.Thor.Filter.Range) => Promise<T[]>): Promise<T[]> {
            const key = `${this.gid}-notifier-filter-range-start_${kind}`

            const headNum = this.thor.status.head.number
            const savedRange = localStorage.getItem(key)
            const rangeStart = Math.max(parseInt(savedRange!) || headNum, headNum - 8640) // span no longer than a day
            if (rangeStart === 0) {
                return []
            }

            const result = await query({ unit: 'block', from: rangeStart, to: 2 ** 32 - 1 })
            const last = result[result.length - 1]
            if (last) {
                localStorage.setItem(key, (last.meta.blockNumber + 1).toString())
            } else if (!savedRange || headNum > rangeStart + 100) {
                localStorage.setItem(key, headNum.toString())
            }
            return result
        },
        notify(dir: 'in' | 'out', amount: string, decimals: number, symbol: string, walletId: number, addressIndex: number) {
            if (dir === 'in') {
                playChime()
            }
            const parts = formatAmount(amount, { unit: decimals, fixed: 2, fullPrecision: true })!
            amount = `${parts.int}${parts.sep}${parts.dec}`

            // a token picks its own symbol: never as HTML
            const safeSymbol = symbol.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
            const message = dir === 'in'
                ? `${this.$t('common.received')} <strong>${amount}</strong> ${safeSymbol}`
                : `${this.$t('common.sent')} <strong>${amount}</strong> ${safeSymbol}`

            addNotification({
                id: `${dir}:${walletId}:${addressIndex}:${symbol}:${amount}:${Math.floor(Date.now() / 10000)}`,
                kind: dir,
                title: `${dir === 'in' ? this.$t('common.received') : this.$t('common.sent')} ${amount} ${symbol}`,
                route: { name: 'address', params: { walletId: walletId.toString(), addressIndex: addressIndex.toString() } }
            })
            emitBalancePulse({ walletId, addressIndex, dir, text: `${amount} ${symbol}` })

            this.$q.notify({
                color: 'secondary',
                message,
                position: 'top-right',
                html: true,
                timeout: 5 * 1000,
                group: false,
                classes: 'transfer-notify_w100',
                actions: [{
                    label: this.$t('common.view'),
                    color: 'white',
                    handler: () => this.$router.push({
                        name: 'address',
                        params: {
                            walletId: walletId.toString(),
                            addressIndex: addressIndex.toString()
                        }
                    }).catch(() => { })
                }, {
                    label: this.$t('common.dismiss'),
                    color: 'white'
                }]

            })
        }
    },
    render() {
        return null
    }
})
</script>
<style>
.transfer-notify_w100 {
    width: 100%;
}
</style>
