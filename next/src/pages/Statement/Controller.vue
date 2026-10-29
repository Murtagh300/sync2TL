<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('statement.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('statement.msg_intro')}}</p>
            <q-select
                v-model="month"
                :options="months"
                emit-value
                map-options
                outlined
                dense
                :label="$t('statement.label_month')"
                class="q-mb-md"
            />
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton height="140px" />
                <q-skeleton height="200px" />
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <template v-else>
                <q-markup-table
                    flat
                    dense
                    class="bvm-tile sum q-mb-md"
                >
                    <thead>
                        <tr>
                            <th class="text-left">{{$t('statement.col_token')}}</th>
                            <th class="text-right">{{$t('statement.col_start')}}</th>
                            <th class="text-right">{{$t('statement.col_in')}}</th>
                            <th class="text-right">{{$t('statement.col_out')}}</th>
                            <th class="text-right">{{$t('statement.col_end')}}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="!shownLines.length">
                            <td
                                colspan="5"
                                class="text-center text-muted"
                            >{{$t('statement.msg_quiet')}}</td>
                        </tr>
                        <tr
                            v-for="l in shownLines"
                            :key="l.symbol"
                        >
                            <td class="text-weight-bold">{{l.symbol}}</td>
                            <td class="text-right">{{l.start}}</td>
                            <td class="text-right text-primary">{{l.in}}</td>
                            <td class="text-right">{{l.out}}<div
                                v-if="l.fees"
                                class="text-caption text-muted"
                            >{{$t('statement.label_fees', { n: l.fees })}}</div></td>
                            <td class="text-right text-weight-bold">{{l.end}}</td>
                        </tr>
                    </tbody>
                </q-markup-table>
                <div class="text-weight-bold q-mb-xs">{{$t('statement.label_transactions', { n: txRows.length })}}</div>
                <q-list
                    v-if="txRows.length"
                    class="bvm-list"
                >
                    <q-item
                        v-for="(t, i) in txRows.slice(0, 200)"
                        :key="i"
                        dense
                    >
                        <q-item-section>
                            <q-item-label>{{t.amount}}</q-item-label>
                            <q-item-label caption>{{t.date}} · <address-label
                                :addr="t.counterparty"
                                compact
                            /></q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
                <p class="text-caption text-muted q-mt-md">{{$t('statement.msg_vtho')}}</p>
            </template>
        </page-content>
        <page-action>
            <q-btn
                unelevated
                no-caps
                color="primary"
                icon="o_picture_as_pdf"
                :disable="loading || error"
                :label="$t('statement.action_pdf')"
                @click="print()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import EmptyState from 'components/EmptyState.vue'
import AddressLabel from 'components/AddressLabel.vue'
import { genesises } from 'src/consts'
import { numberLocale } from 'src/utils/format'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { feesByTx, flows, ZERO, type Flow } from 'src/utils/overview'
import { monthRange, netByToken, statementHtml, statementLines, VTHO, type StatementLine } from 'src/utils/statement'
import { printPage } from 'src/utils/receipt'
import { nameOf } from 'src/utils/names'

type Spec = { symbol: string, decimals: number }

// a monthly statement per wallet: balances, in and out, every transaction; as PDF
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, EmptyState, AddressLabel },
    data: () => {
        const d = new Date()
        // last month: the first complete one
        const last = new Date(d.getFullYear(), d.getMonth() - 1, 1)
        return {
            month: `${last.getFullYear()}-${last.getMonth()}`,
            addresses: [] as string[],
            specs: new Map<string, Spec>(),
            lines: [] as StatementLine[],
            list: [] as Flow[],
            loading: true,
            error: false
        }
    },
    computed: {
        months(): { label: string, value: string }[] {
            const now = new Date()
            return Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                return { label: d.toLocaleDateString(this.$i18n.locale, { month: 'long', year: 'numeric' }), value: `${d.getFullYear()}-${d.getMonth()}` }
            })
        },
        range(): [number, number] {
            const [y, m] = this.month.split('-').map(Number)
            return monthRange(y!, m!)
        },
        shownLines(): { symbol: string, start: string, in: string, out: string, fees: string, end: string }[] {
            return this.lines.map(l => {
                const s = this.specs.get(l.token) || { symbol: '?', decimals: 18 }
                const f = (v: bigint) => this.amount(v, s.decimals)
                // VTHO also goes to fees of transactions that moved nothing: its balances can't be worked back
                const vtho = l.token === VTHO
                return { symbol: s.symbol, start: vtho ? '—' : f(l.start), in: f(l.in), out: f(l.out), fees: l.fees ? f(l.fees) : '', end: vtho ? '—' : f(l.end) }
            })
        },
        txRows(): { date: string, amount: string, counterparty: string, with: string }[] {
            const mine = new Set(this.addresses)
            return this.list
                .filter(f => this.specs.has(f.token) && !mine.has(f.counterparty.toLowerCase()))
                .sort((a, b) => a.time - b.time)
                .map(f => {
                    const s = this.specs.get(f.token)!
                    return {
                        date: new Date(f.time).toLocaleString(this.$i18n.locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                        amount: `${f.dir === 'in' ? '+' : '−'}${this.amount(f.amount, s.decimals)} ${s.symbol}`,
                        counterparty: f.counterparty,
                        with: [nameOf(f.counterparty), f.counterparty].filter(Boolean).join(' · ')
                    }
                })
        }
    },
    watch: {
        month() { void this.load() }
    },
    async created() {
        const main = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
        const chosen = selection.walletId === ALL_WALLETS ? main : [selectedWallet(main)].filter((w): w is M.Wallet => !!w)
        this.addresses = [...new Set(chosen.flatMap(w => w.meta.addresses.map(a => a.toLowerCase())))]
        const specs = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id)
        this.specs = new Map(specs.map(t => [(t.address || ZERO).toLowerCase(), { symbol: t.symbol, decimals: t.decimals }]))
        this.specs.set(ZERO, { symbol: 'VET', decimals: 18 })
        await this.load()
    },
    methods: {
        amount(v: bigint, decimals: number) {
            return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 2 }).format(new BigNumber(v.toString()).div(new BigNumber(10).pow(decimals)).toNumber())
        },
        async load() {
            if (!this.addresses.length) {
                this.loading = false
                return
            }
            this.loading = true
            this.error = false
            try {
                const thor = this.$svc.bc(genesises.main.id).thor
                const bc = this.$svc.bc(genesises.main.id)
                const [from, to] = this.range
                const [inMonth, after] = await Promise.all([
                    flows(thor, this.addresses, from, to),
                    flows(thor, this.addresses, to + 1, Date.now())
                ])
                const ownTx = (l: Flow[]) => [...new Set(l.filter(f => this.addresses.includes(f.origin)).map(f => f.txId))]
                // the month's fees; the VTHO balance itself isn't worked back (see shownLines)
                const feesIn = await feesByTx(thor, this.addresses, ownTx(inMonth))
                const sum = (m: Map<string, bigint>) => [...m.values()].reduce((a, b) => a + b, 0n)
                const tokens = [...this.specs.keys()]
                // today's balances, every address together
                const now = new Map<string, bigint>()
                const all = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id)
                for (const spec of all) {
                    const key = (spec.address || ZERO).toLowerCase()
                    let total = 0n
                    for (const a of this.addresses) total += BigInt(new BigNumber(await bc.balanceOf(a, spec).catch(() => '0')).toFixed(0))
                    now.set(key, total)
                }
                this.list = inMonth
                this.lines = statementLines(tokens, now, netByToken(inMonth, this.addresses), netByToken(after, this.addresses), sum(feesIn.fees), 0n)
            } catch (err) {
                console.warn('statement:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        print() {
            const t = (k: string, p?: Record<string, unknown>) => this.$t(`statement.${k}`, p || {})
            const period = this.months.find(m => m.value === this.month)?.label || ''
            printPage(statementHtml({
                title: t('pdf_title', { period }),
                period,
                addresses: t('pdf_addresses'),
                token: t('col_token'),
                start: t('col_start'),
                in: t('col_in'),
                out: t('col_out'),
                fees: t('col_fees'),
                end: t('col_end'),
                transactions: t('label_transactions', { n: this.txRows.length }),
                date: t('pdf_date'),
                amount: t('pdf_amount'),
                with: t('pdf_with'),
                none: t('msg_quiet'),
                footer: t('msg_vtho')
            }, this.shownLines, this.txRows, this.addresses, this.$i18n.locale))
        }
    }
})
</script>
<style lang="sass" scoped>
.sum
  background: transparent
</style>
