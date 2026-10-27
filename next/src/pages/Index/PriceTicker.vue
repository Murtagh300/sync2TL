<template>
    <!-- prices of VET, VTHO, B3TR and pinned tokens, running across the top of home -->
    <div
        v-if="items.length"
        class="ticker"
        :aria-label="$t('widgets.ticker')"
        role="list"
    >
        <div
            class="ticker-track"
            :class="{ 'ticker-track--run': run }"
        >
            <!-- twice, so the loop has no gap -->
            <template
                v-for="copy in (run ? 2 : 1)"
                :key="copy"
            >
                <button
                    v-for="it in items"
                    :key="copy + it.symbol"
                    type="button"
                    class="ticker-item"
                    role="listitem"
                    :aria-hidden="copy === 2"
                    :tabindex="copy === 2 ? -1 : 0"
                    @click="open(it.symbol)"
                >
                    <span class="text-weight-bold">{{it.symbol}}</span>
                    <span class="ticker-price">{{it.price}}</span>
                    <span :class="it.change >= 0 ? 'text-primary' : 'text-negative'">{{it.change >= 0 ? '▲' : '▼'}} {{$fixed(Math.abs(it.change), 1)}}%</span>
                </button>
            </template>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { money, prefs } from 'src/utils/prefs'
import type { TokenPrefs } from 'src/utils/tokens'
import { genesises } from 'src/consts'

const DEFAULT = ['VET', 'VTHO', 'B3TR']

export default defineComponent({
    props: {
        wallet: { type: Object as () => M.Wallet, required: true }
    },
    data: () => ({
        items: [] as { symbol: string, price: string, change: number }[],
        timer: 0 as ReturnType<typeof setInterval> | 0
    }),
    computed: {
        /** runs only with enough items, and not for people who asked for less motion */
        run(): boolean {
            const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
            return this.items.length >= 4 && !reduced
        }
    },
    created() {
        void this.load()
        this.timer = setInterval(() => void this.load(), 60 * 1000)
    },
    beforeUnmount() {
        this.timer && clearInterval(this.timer)
    },
    methods: {
        async load() {
            try {
                const [all, tokenPrefs, fx] = await Promise.all([
                    this.$svc.config.token.all(),
                    this.$svc.config.getJSON<TokenPrefs>('token-prefs', { pinned: [], hidden: [] }),
                    this.$svc.prices.fx(prefs.currency)
                ])
                const symbols = [...new Set([...DEFAULT, ...tokenPrefs.pinned])]
                const specs = symbols
                    .map(s => all.find(t => t.gid === genesises.main.id && t.symbol === s))
                    .filter((t): t is M.TokenSpec => !!t)
                const stats = await this.$svc.prices.stats(specs.map(s => s.address))
                const statOf = (spec: M.TokenSpec) => stats[(spec.address || '0x0000000000000000000000000000000000000000').toLowerCase()]
                this.items = specs
                    .filter(s => statOf(s))
                    .map(s => ({ symbol: s.symbol, price: money(statOf(s)!.price * fx), change: statOf(s)!.change24h }))
            } catch {
                // prices unreachable: keep what was shown
            }
        },
        open(symbol: string) {
            void this.$router.push({ name: 'asset', params: { walletId: String(this.wallet.id), addressIndex: '0', symbol } })
        }
    }
})
</script>
<style lang="sass" scoped>
.ticker
  overflow-x: auto
  scrollbar-width: none
  margin: 0 -16px
  padding: 4px 0
  border-top: 1px solid $hairline
  border-bottom: 1px solid $hairline
  mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent)
  &::-webkit-scrollbar
    display: none

.ticker-track
  display: flex
  width: max-content

.ticker-track--run
  animation: ticker 40s linear infinite
  &:hover, &:focus-within
    animation-play-state: paused

@keyframes ticker
  from
    transform: translateX(0)
  to
    transform: translateX(-50%)

.ticker-item
  display: inline-flex
  gap: 6px
  align-items: baseline
  padding: 4px 16px
  border: 0
  background: none
  color: inherit
  font: inherit
  font-size: 13px
  white-space: nowrap
  cursor: pointer
  font-variant-numeric: tabular-nums

.ticker-price
  color: $text-soft
</style>
