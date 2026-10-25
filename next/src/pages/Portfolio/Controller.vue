<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('portfolio.title')" />
        <page-content
            class="col"
            padding
        >
            <div class="bvm-tile q-pa-md q-mb-md">
                <div class="row items-end no-wrap">
                    <div class="col">
                        <div class="text-muted">{{scopeName}}</div>
                        <div class="bvm-display total">{{portfolio ? money(portfolio.totalUsd * fx) : '…'}}</div>
                        <div
                            v-if="change !== null"
                            class="change"
                            :class="change >= 0 ? 'text-primary' : 'text-negative'"
                        >{{change >= 0 ? '+' : ''}}{{change.toFixed(2)}}% · {{rangeLabel}}</div>
                    </div>
                    <div class="row no-wrap ranges">
                        <button
                            v-for="r in ranges"
                            :key="r.key"
                            type="button"
                            class="range"
                            :class="{ 'range--on': r.key === range }"
                            @click="range = r.key"
                        >{{r.label}}</button>
                    </div>
                </div>
                <q-skeleton
                    v-if="loading"
                    class="q-mt-md"
                    height="120px"
                />
                <sparkline
                    v-else-if="line.length > 2"
                    class="q-mt-md chart"
                    :values="line"
                    :label="$t('portfolio.title')"
                />
                <div
                    v-else
                    class="text-muted q-mt-md"
                >{{range === 'all' ? $t('portfolio.msg_growing') : $t('asset.msg_no_chart')}}</div>
            </div>

            <div
                v-if="movers.best || movers.worst"
                class="row no-wrap q-gutter-x-sm q-mb-md"
            >
                <div
                    v-if="movers.best"
                    class="col bvm-tile q-pa-md"
                >
                    <div class="text-muted mover-label">{{$t('portfolio.label_best')}}</div>
                    <div class="row no-wrap items-center q-mt-xs">
                        <token-avatar
                            :spec="movers.best.spec"
                            size="22px"
                        />
                        <span class="q-ml-sm text-weight-bold">{{movers.best.spec.symbol}}</span>
                        <q-space />
                        <span class="text-primary text-weight-bold">+{{movers.best.change.toFixed(1)}}%</span>
                    </div>
                </div>
                <div
                    v-if="movers.worst"
                    class="col bvm-tile q-pa-md"
                >
                    <div class="text-muted mover-label">{{$t('portfolio.label_worst')}}</div>
                    <div class="row no-wrap items-center q-mt-xs">
                        <token-avatar
                            :spec="movers.worst.spec"
                            size="22px"
                        />
                        <span class="q-ml-sm text-weight-bold">{{movers.worst.spec.symbol}}</span>
                        <q-space />
                        <span class="text-negative text-weight-bold">{{movers.worst.change.toFixed(1)}}%</span>
                    </div>
                </div>
            </div>

            <q-btn
                outline
                no-caps
                color="primary"
                icon="o_water_drop"
                class="full-width q-mb-md"
                :label="$t('liquidity.action_open')"
                :to="{ name: 'liquidity' }"
            />
            <div class="bvm-label q-mb-sm">{{$t('portfolio.label_holdings')}}</div>
            <q-list class="bvm-list">
                <q-item
                    v-for="h in priced"
                    :key="h.spec.symbol"
                >
                    <q-item-section avatar>
                        <token-avatar
                            :spec="h.spec"
                            size="32px"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>{{h.spec.symbol}}</q-item-label>
                        <q-linear-progress
                            :value="share(h.usd)"
                            color="primary"
                            track-color="grey-9"
                            rounded
                            class="q-mt-xs"
                        />
                    </q-item-section>
                    <q-item-section side>
                        <div class="bvm-amount value">{{money(h.usd * fx)}}</div>
                        <div class="text-muted">{{(share(h.usd) * 100).toFixed(1)}}%</div>
                    </q-item-section>
                </q-item>
            </q-list>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import Sparkline from 'components/Sparkline.vue'
import TokenAvatar from 'components/TokenAvatar.vue'
import { walletPortfolio, type Holding, type Portfolio } from 'src/utils/portfolio'
import { dayValues } from 'src/utils/value-history'
import { money, prefs } from 'src/utils/prefs'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'

type Range = '7d' | '30d' | 'all'

// what the wallet is worth over time, which tokens carried it, and what it is made of
export default defineComponent({
    components: { PageToolbar, PageContent, Sparkline, TokenAvatar },
    data: () => ({
        range: '30d' as Range,
        loading: true,
        portfolio: null as Portfolio | null,
        series30: [] as number[],
        series7: [] as number[],
        wallets: [] as M.Wallet[],
        fx: 1,
        movers: { best: null, worst: null } as { best: { spec: M.TokenSpec, change: number } | null, worst: { spec: M.TokenSpec, change: number } | null }
    }),
    computed: {
        all(): boolean {
            return selection.walletId === ALL_WALLETS
        },
        scope(): string {
            return this.all ? 'all' : String(selectedWallet(this.wallets)?.id ?? '')
        },
        scopeName(): string {
            return this.all ? this.$t('home.label_all_wallets') : selectedWallet(this.wallets)?.meta.name || ''
        },
        ranges(): { key: Range, label: string }[] {
            return [
                { key: '7d', label: this.$t('portfolio.range_7d') },
                { key: '30d', label: this.$t('portfolio.range_30d') },
                { key: 'all', label: this.$t('portfolio.range_all') }
            ]
        },
        rangeLabel(): string {
            return this.ranges.find(r => r.key === this.range)?.label || ''
        },
        line(): number[] {
            if (this.range === '7d') return this.series7
            if (this.range === '30d') return this.series30
            return dayValues(this.scope).map(d => d.usd)
        },
        change(): number | null {
            const l = this.line
            return l.length > 1 && l[0]! > 0 ? (l[l.length - 1]! / l[0]! - 1) * 100 : null
        },
        priced(): Holding[] {
            return (this.portfolio?.holdings || []).filter(h => h.usd > 0)
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        this.fx = await this.$svc.prices.fx(prefs.currency)
        const target = this.all ? this.wallets : (selectedWallet(this.wallets) ? [selectedWallet(this.wallets)!] : [])
        try {
            // a month of hourly values; the last week of it for 7D; one point per day for the chart
            const p = await walletPortfolio(this.$svc, target, { withSeries: true, hours: 720 })
            this.portfolio = p
            const s = p?.series || []
            this.series30 = s.filter((_, i) => i % 24 === 0 || i === s.length - 1)
            this.series7 = s.slice(-24 * 7)
            if (p) {
                await this.findMovers(p)
            }
        } finally {
            this.loading = false
        }
    },
    methods: {
        money,
        share(usd: number) {
            const total = this.portfolio?.totalUsd || 0
            return total ? usd / total : 0
        },
        /** the best and worst token over the month, by price */
        async findMovers(p: Portfolio) {
            const priced = p.holdings.filter(h => h.usd > 0)
            const history = await this.$svc.prices.history(priced.map(h => h.spec.address), 720)
            const changes = priced.map(h => {
                const pts = history[(h.spec.address || '0x0000000000000000000000000000000000000000').toLowerCase()] || []
                const first = pts[0]?.price
                const last = pts[pts.length - 1]?.price
                return { spec: h.spec, change: first && last ? (last / first - 1) * 100 : 0 }
            }).filter(c => c.change !== 0).sort((a, b) => b.change - a.change)
            this.movers = {
                best: changes[0] && changes[0].change > 0 ? changes[0] : null,
                worst: changes.length && changes[changes.length - 1]!.change < 0 ? changes[changes.length - 1]! : null
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.total
  font-size: 34px

.change
  font-size: 13px
  font-weight: 700

.ranges
  gap: 4px

.range
  padding: 4px 10px
  border-radius: 999px
  border: 1px solid $hairline-2
  background: none
  color: $text-muted
  font: inherit
  font-size: 12px
  font-weight: 800
  cursor: pointer

.range--on
  border-color: var(--q-primary)
  color: var(--q-primary)

.chart
  height: 120px !important

.mover-label
  font-size: 12px

.value
  font-size: 15px
</style>
