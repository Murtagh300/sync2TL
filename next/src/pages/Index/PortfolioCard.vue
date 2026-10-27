<template>
    <div class="portfolio-card">
        <div class="row items-center no-wrap">
            <div class="text-muted portfolio-label">{{$t('home.label_total')}}</div>
            <q-btn
                flat
                round
                dense
                size="sm"
                class="q-ml-xs text-muted"
                :icon="prefs.hideBalances ? 'o_visibility_off' : 'o_visibility'"
                :aria-label="$t('home.action_hide')"
                @click.stop="toggleHidden()"
            />
        </div>
        <div
            v-if="supported"
            class="portfolio-total bvm-display"
        >
            <template v-if="shown">{{money(fiat(shown.totalUsd))}}</template>
            <q-skeleton
                v-else
                type="text"
                width="60%"
                height="56px"
            />
        </div>
        <div
            v-else
            class="text-muted q-mt-sm"
        >{{$t('home.msg_no_prices')}}</div>
        <div
            v-if="shown && supported"
            class="row items-center q-mt-xs"
        >
            <span
                class="change-pill"
                :class="shown.change24h >= 0 ? 'change-pill--up' : 'change-pill--down'"
            >{{shown.change24h >= 0 ? '▲' : '▼'}} {{$fixed(Math.abs(shown.change24h), 2)}}%</span>
            <span class="text-muted q-ml-sm change-label">{{$t('home.label_24h')}}</span>
            <q-space />
            <span
                v-if="nftLine"
                class="text-muted change-label"
            >{{nftLine}}</span>
        </div>
        <sparkline
            v-if="shown && shown.series.length > 2 && !prefs.hideBalances"
            class="q-mt-md"
            :values="shown.series"
            :label="$t('home.label_7d')"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Sparkline from 'components/Sparkline.vue'
import { walletPortfolio, type Portfolio } from 'src/utils/portfolio'
import { haptic, money, prefs } from 'src/utils/prefs'
import { readSnapshot, writeSnapshot } from 'src/utils/snapshot'
import { recordDayValue } from 'src/utils/value-history'

// what the selected wallet is worth, and how that moved
export default defineComponent({
    components: { Sparkline },
    props: {
        wallet: { type: Object as () => M.Wallet, required: true },
        /** the wallets to sum (all of them for "All wallets") */
        wallets: { type: Array as () => M.Wallet[], default: () => [] },
        /** where the last value and the daily history are kept */
        scope: { type: String, default: '' }
    },
    data: () => ({
        prefs,
        fx: 1,
        nftLine: '',
        // async computed (see src/shims-async-computed.d.ts)
        portfolio: null as Portfolio | null
    }),
    computed: {
        /** the current portfolio, or the last one while it loads */
        shown(): Portfolio | null {
            return this.portfolio || readSnapshot<Portfolio>(`portfolio:${this.key}`)?.value || null
        },
        key(): string {
            return this.scope || String(this.wallet.id)
        },
        supported(): boolean {
            return this.$svc.bvm.supports(this.wallet.gid)
        }
    },
    watch: {
        'prefs.currency': {
            async handler(c: 'EUR' | 'USD') {
                this.fx = await this.$svc.prices.fx(c)
            },
            immediate: true
        },
        wallet: {
            handler() { void this.loadNfts() },
            immediate: true
        }
    },
    asyncComputed: {
        async portfolio(): Promise<Portfolio | null> {
            const p = await walletPortfolio(this.$svc, this.wallets.length ? this.wallets : this.wallet, { withSeries: true }).catch(() => null)
            if (p) {
                // what is drawn next time, before this is computed again
                writeSnapshot(`portfolio:${this.key}`, { totalUsd: p.totalUsd, change24h: p.change24h, series: p.series, holdings: [] })
                recordDayValue(this.key, p.totalUsd)
            }
            return p
        }
    },
    methods: {
        money,
        fiat(usd: number) {
            return usd * this.fx
        },
        toggleHidden() {
            prefs.hideBalances = !prefs.hideBalances
            haptic()
        },
        /** NFTs at floor, as a second line */
        async loadNfts() {
            this.nftLine = ''
            if (!this.supported) {
                return
            }
            try {
                const addresses = (this.wallets.length ? this.wallets : [this.wallet]).flatMap(w => w.meta.addresses)
                const counts = await Promise.all(addresses.map(a => this.$svc.bvm.holdings(a, { limit: 1 }).then(h => h.summary.total).catch(() => 0)))
                const n = counts.reduce((a, b) => a + b, 0)
                this.nftLine = n ? this.$t('home.label_nfts', { n }) : ''
            } catch { }
        },
        refresh() {
            void this.$asyncComputed.portfolio?.update()
            void this.loadNfts()
        }
    }
})
</script>
<style lang="sass" scoped>
.portfolio-card
  padding: 8px 4px 0

.portfolio-label
  font-size: 14px
  font-weight: 700

.portfolio-total
  font-size: 46px
  line-height: 1.05
  margin-top: 2px

.change-pill
  padding: 2px 8px
  border-radius: 999px
  font-size: 13px
  font-weight: 800
  font-variant-numeric: tabular-nums

.change-pill--up
  color: var(--q-primary)
  background: var(--bv-accent-soft, color-mix(in srgb, var(--q-primary) 10%, transparent))

.change-pill--down
  color: $negative
  background: rgba(248, 113, 113, 0.10)

.change-label
  font-size: 13px
</style>
