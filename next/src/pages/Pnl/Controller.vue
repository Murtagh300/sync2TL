<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('pnl.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('pnl.msg_intro')}}</p>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 4"
                    :key="i"
                    height="64px"
                />
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <empty-state
                v-else-if="!rows.length"
                icon="o_query_stats"
                :text="$t('pnl.msg_none')"
            />
            <template v-else>
                <div class="row q-col-gutter-sm q-mb-md">
                    <div class="col-6">
                        <div class="bvm-tile tile">
                            <div class="text-muted tile-label">{{$t('pnl.label_unrealized')}}</div>
                            <div
                                class="bvm-amount tile-value"
                                :class="tone(totalUnrealized)"
                            >{{signed(totalUnrealized)}}</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="bvm-tile tile">
                            <div class="text-muted tile-label">{{$t('pnl.label_realized')}}</div>
                            <div
                                class="bvm-amount tile-value"
                                :class="tone(totalRealized)"
                            >{{signed(totalRealized)}}</div>
                        </div>
                    </div>
                </div>
                <q-list role="group" class="bvm-list">
                    <q-item
                        v-for="r in rows"
                        :key="r.token"
                    >
                        <q-item-section style="min-width: 0">
                            <q-item-label class="text-weight-bold">{{r.symbol}}</q-item-label>
                            <q-item-label caption>{{r.qty > 0 ? $t('pnl.label_avg', { price: fmtVet(r.avgVet), now: r.nowVet === null ? '–' : fmtVet(r.nowVet) }) : $t('pnl.label_sold_all')}}</q-item-label>
                            <q-item-label
                                v-if="r.unknown > 0"
                                caption
                            >{{$t('pnl.label_unknown', { n: fmt(r.unknown) })}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <span
                                v-if="r.unrealizedPct !== null"
                                class="bvm-amount"
                                :class="tone(r.unrealized)"
                            >{{r.unrealizedPct >= 0 ? '+' : ''}}{{$fixed(r.unrealizedPct, 1)}}%</span>
                            <span
                                class="text-caption"
                                :class="tone(r.unrealized)"
                            >{{signed(r.unrealized)}}</span>
                        </q-item-section>
                    </q-item>
                </q-list>
                <p class="text-caption text-muted q-mt-md">{{$t('pnl.msg_how')}}</p>
            </template>
            <!-- a year of transfers for tax software -->
            <div
                v-if="!loading"
                class="bvm-tile tax q-mt-lg"
            >
                <div class="text-weight-bold">{{$t('tax.title')}}</div>
                <div class="text-muted tax-msg q-mt-xs">{{$t('tax.msg')}}</div>
                <div class="row no-wrap items-center q-gutter-x-sm q-mt-md">
                    <q-btn-toggle
                        v-model="taxYear"
                        class="tax-years"
                        dense
                        no-caps
                        unelevated
                        color="transparent"
                        text-color="grey-5"
                        toggle-color="primary"
                        toggle-text-color="dark"
                        :options="years.map(y => ({ value: y, label: String(y) }))"
                    />
                    <q-space />
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        icon="o_download"
                        :label="$t('tax.action_download')"
                        :loading="exporting"
                        @click="exportYear()"
                    />
                </div>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { feesByTx, flows, yearRange, ZERO } from 'src/utils/overview'
import { KOINLY_HEADERS, koinlyRows } from 'src/utils/tax-export'
import { downloadText } from 'src/utils/export'
import { costBasis } from 'src/utils/cost-basis'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { money, prefs } from 'src/utils/prefs'
import { genesises } from 'src/consts'

type Row = { token: string, symbol: string, qty: number, avgVet: number, nowVet: number | null, unknown: number, unrealized: number, unrealizedPct: number | null, realized: number }

// what tokens cost, what they are worth now, and what selling them made, from the last year
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState },
    data: () => ({
        loading: true,
        error: false,
        rows: [] as Row[],
        /** fiat per VET, to show VET amounts in money */
        vetFiat: 0,
        taxYear: new Date().getFullYear() - 1,
        exporting: false
    }),
    computed: {
        /** this year and the two before */
        years(): number[] {
            const y = new Date().getFullYear()
            return [y - 2, y - 1, y]
        },
        totalUnrealized(): number {
            return this.rows.reduce((s, r) => s + r.unrealized, 0)
        },
        totalRealized(): number {
            return this.rows.reduce((s, r) => s + r.realized, 0)
        }
    },
    async created() {
        await this.load()
    },
    methods: {
        fmt(v: number) {
            return v.toLocaleString(this.$i18n.locale, { maximumFractionDigits: v >= 100 ? 0 : 4 })
        },
        fmtVet(v: number) {
            return `${v.toLocaleString(this.$i18n.locale, { maximumSignificantDigits: 4 })} VET`
        },
        /** VET as money, with a sign */
        signed(vet: number) {
            const v = vet * this.vetFiat
            return `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`
        },
        tone(v: number) {
            return v > 0 ? 'text-primary' : v < 0 ? 'text-negative' : ''
        },
        async addresses(): Promise<string[]> {
            const main = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
            const chosen = selection.walletId === ALL_WALLETS ? main : [selectedWallet(main)].filter((w): w is M.Wallet => !!w)
            return [...new Set(chosen.flatMap(w => w.meta.addresses.map(a => a.toLowerCase())))]
        },
        /** the chosen year as a Koinly CSV, with the VTHO fees this wallet paid */
        async exportYear() {
            this.exporting = true
            try {
                const addresses = await this.addresses()
                const thor = this.$svc.bc(genesises.main.id).thor
                const [from, to] = yearRange(this.taxYear)
                const [list, specs] = await Promise.all([
                    flows(thor, addresses, from, Math.min(to, Date.now())),
                    this.$svc.config.token.all()
                ])
                const known = new Map(specs.filter(t => t.gid === genesises.main.id).map(t => [(t.address || ZERO).toLowerCase(), t]))
                known.set(ZERO, { symbol: 'VET', decimals: 18 } as M.TokenSpec)
                const ownTx = [...new Set(list.filter(f => addresses.includes(f.origin)).map(f => f.txId))]
                const { fees, complete } = await feesByTx(thor, addresses, ownTx)
                const rows = koinlyRows(list, t => known.get(t), fees)
                if (!rows.length) {
                    this.$q.notify({ message: this.$t('tax.msg_empty', { year: this.taxYear }).toString() })
                    return
                }
                const csv = [KOINLY_HEADERS, ...rows].map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n')
                downloadText(`blackvault-${this.taxYear}-koinly.csv`, csv)
                this.$q.notify({
                    type: 'positive',
                    message: this.$t(complete ? 'tax.msg_done' : 'tax.msg_done_fees_partial', { n: rows.length }).toString()
                })
            } catch (err) {
                console.warn('tax export:', err)
                this.$q.notify({ type: 'negative', message: this.$t('common.something_wrong').toString() })
            } finally {
                this.exporting = false
            }
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                const addresses = await this.addresses()
                if (!addresses.length) {
                    this.rows = []
                    return
                }
                const thor = this.$svc.bc(genesises.main.id).thor
                const now = Date.now()
                const list = await flows(thor, addresses, now - 365 * 24 * 3600 * 1000, now)
                const specs = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id)
                const spec = (t: string) => specs.find(s => (s.address || ZERO).toLowerCase() === t)
                const book = costBasis(list, t => spec(t)?.decimals ?? 18).filter(e => !!spec(e.token))
                const [stats, fx] = await Promise.all([
                    this.$svc.prices.stats([ZERO, ...book.map(e => e.token)]).catch(() => ({} as Record<string, { price: number }>)),
                    this.$svc.prices.fx(prefs.currency)
                ])
                const vetUsd = stats[ZERO]?.price || 0
                this.vetFiat = vetUsd * fx
                this.rows = book.map(e => {
                    const usd = stats[e.token]?.price
                    const nowVet = usd !== undefined && vetUsd ? usd / vetUsd : null
                    const avgVet = e.qty > 0 ? e.cost / e.qty : 0
                    const worth = nowVet !== null ? e.qty * nowVet : null
                    return {
                        token: e.token,
                        symbol: spec(e.token)!.symbol,
                        qty: e.qty,
                        avgVet,
                        nowVet,
                        unknown: e.unknown,
                        unrealized: worth !== null ? worth - e.cost : 0,
                        unrealizedPct: worth !== null && e.cost > 0 ? (worth / e.cost - 1) * 100 : null,
                        realized: e.realized
                    }
                }).sort((a, b) => Math.abs(b.unrealized) + Math.abs(b.realized) - Math.abs(a.unrealized) - Math.abs(a.realized))
            } catch (err) {
                console.warn('pnl:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.tile
  padding: 12px 14px

.tile-label
  font-size: 12px
  font-weight: 700

.tile-value
  font-size: 18px
  margin-top: 2px

.tax
  padding: 14px

.tax-msg
  font-size: 13px

.tax-years
  border: 1px solid $hairline-2
  border-radius: $radius
  :deep(.q-btn)
    min-height: 34px
    padding: 0 10px
    font-weight: 700
</style>
