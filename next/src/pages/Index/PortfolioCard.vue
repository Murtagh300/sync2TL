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
                @click="toggleHidden()"
            />
        </div>
        <div
            v-if="supported"
            class="portfolio-total bvm-display"
        >
            <template v-if="portfolio">{{money(fiat(portfolio.totalUsd))}}</template>
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
            v-if="portfolio && supported"
            class="row items-center q-mt-xs"
        >
            <span
                class="change-pill"
                :class="portfolio.change24h >= 0 ? 'change-pill--up' : 'change-pill--down'"
            >{{portfolio.change24h >= 0 ? '▲' : '▼'}} {{Math.abs(portfolio.change24h).toFixed(2)}}%</span>
            <span class="text-muted q-ml-sm change-label">{{$t('home.label_24h')}}</span>
            <q-space />
            <span
                v-if="nftLine"
                class="text-muted change-label"
            >{{nftLine}}</span>
        </div>
        <sparkline
            v-if="portfolio && portfolio.series.length > 2 && !prefs.hideBalances"
            class="q-mt-md"
            :values="portfolio.series"
            :label="$t('home.label_7d')"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Sparkline from 'components/Sparkline.vue'
import { walletPortfolio, type Portfolio } from 'src/utils/portfolio'
import { haptic, money, prefs } from 'src/utils/prefs'

// what the selected wallet is worth, and how that moved
export default defineComponent({
    components: { Sparkline },
    props: {
        wallet: { type: Object as () => M.Wallet, required: true }
    },
    data: () => ({
        prefs,
        fx: 1,
        nftLine: '',
        // async computed (see src/shims-async-computed.d.ts)
        portfolio: null as Portfolio | null
    }),
    computed: {
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
        portfolio(): Promise<Portfolio | null> {
            return walletPortfolio(this.$svc, this.wallet, { withSeries: true }).catch(() => null)
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
                const counts = await Promise.all(this.wallet.meta.addresses.map(a => this.$svc.bvm.holdings(a, { limit: 1 }).then(h => h.summary.total).catch(() => 0)))
                const n = counts.reduce((a, b) => a + b, 0)
                this.nftLine = n ? this.$t('home.label_nfts', { n }) : ''
            } catch { }
        },
        refresh() {
            void this.$asyncComputed.portfolio.update()
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
