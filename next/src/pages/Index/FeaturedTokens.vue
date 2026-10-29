<template>
    <div
        v-if="rows.length"
        class="featured q-mt-lg"
    >
        <div
            v-for="r in rows"
            :key="r.spec.address"
            class="featured-row bvm-tile row no-wrap items-center"
            @click="open(r)"
        >
            <token-avatar
                :spec="r.spec"
                size="36px"
            />
            <div class="col q-ml-sm featured-text">
                <div class="row no-wrap items-baseline">
                    <span class="text-weight-bold">{{r.spec.symbol}}</span>
                    <span
                        v-if="r.change !== null"
                        class="q-ml-xs featured-change"
                        :class="r.change >= 0 ? 'text-primary' : 'text-negative'"
                    >{{r.change >= 0 ? '+' : ''}}{{$fixed(r.change, 1)}}%</span>
                </div>
                <div class="text-muted ellipsis featured-sub">
                    {{fmt(r.balance)}} {{r.spec.symbol}}<template v-if="r.value !== null"> · {{money(r.value)}}</template>
                </div>
            </div>
            <q-btn
                v-if="canBuy"
                unelevated
                no-caps
                dense
                color="primary"
                class="featured-buy"
                :label="$t('featured.action_buy_now')"
                :aria-label="$t('featured.action_buy_symbol', { symbol: r.spec.symbol })"
                @click.stop="buy(r)"
            />
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import TokenAvatar from 'components/TokenAvatar.vue'
import { buyRoute, FEATURED } from 'src/utils/tokens'
import { canSign } from 'src/utils/watch'
import { money, prefs, haptic } from 'src/utils/prefs'
import { numberLocale } from 'src/utils/format'
import { genesises } from 'src/consts'

type Row = { spec: M.TokenSpec, balance: number, value: number | null, change: number | null }

// SQUAD, B3TR and VOT3 on the home screen, always: what you hold, today's move, and a way to buy
export default defineComponent({
    components: { TokenAvatar },
    props: {
        wallet: { type: Object as () => M.Wallet, required: true },
        wallets: { type: Array as () => M.Wallet[], required: true }
    },
    data: () => ({
        rows: [] as Row[]
    }),
    computed: {
        canBuy(): boolean {
            return canSign(this.wallet)
        },
        currency(): string {
            return prefs.currency
        }
    },
    watch: {
        wallets: { handler() { void this.load() }, immediate: true },
        currency() { void this.load() }
    },
    methods: {
        money,
        fmt(v: number) {
            return v.toLocaleString(numberLocale(), { maximumFractionDigits: v >= 100 ? 0 : 2 })
        },
        async load() {
            if (this.wallet.gid !== genesises.main.id) {
                this.rows = []
                return
            }
            const all = await this.$svc.config.token.all()
            const specs = FEATURED.map(f => all.find(t => t.gid === genesises.main.id && t.address.toLowerCase() === f.address)).filter((t): t is M.TokenSpec => !!t)
            const bc = this.$svc.bc(genesises.main.id)
            const addresses = this.wallets.filter(w => w.gid === genesises.main.id).flatMap(w => w.meta.addresses)
            // what is known at once, then the fresh balances and prices
            this.rows = specs.map(spec => ({ spec, balance: 0, value: null, change: null }))
            const [stats, fx] = await Promise.all([
                this.$svc.prices.stats(specs.map(s => s.address)).catch(() => ({} as Record<string, { price: number, change24h: number }>)),
                this.$svc.prices.fx(prefs.currency).catch(() => 1)
            ])
            this.rows = await Promise.all(specs.map(async spec => {
                const raw = await Promise.all(addresses.map(a => bc.balanceOf(a, spec).catch(() => '0')))
                const balance = raw.reduce((s, v) => s.plus(v || 0), new BigNumber(0)).shiftedBy(-spec.decimals).toNumber()
                // VOT3 is B3TR one to one
                const stat = stats[spec.address.toLowerCase()] || (spec.symbol === 'VOT3' ? stats[FEATURED[1]!.address] : undefined)
                return {
                    spec,
                    balance,
                    value: stat ? balance * stat.price * fx : null,
                    change: stat ? stat.change24h : null
                }
            }))
        },
        buy(r: Row) {
            haptic()
            void this.$router.push(buyRoute(r.spec.symbol, this.wallet.id, 0))
        },
        open(r: Row) {
            void this.$router.push({ name: 'asset', params: { walletId: String(this.wallet.id), addressIndex: '0', symbol: r.spec.symbol } })
        }
    }
})
</script>
<style lang="sass" scoped>
.featured
  display: grid
  gap: 8px

.featured-row
  padding: 10px 12px
  cursor: pointer

.featured-text
  min-width: 0

.featured-change
  font-size: 12px
  font-weight: 700

.featured-sub
  font-size: 12px

.featured-buy
  padding: 2px 12px
  font-weight: 800
</style>
