<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('liquidity.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('liquidity.msg_intro')}}</p>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 3"
                    :key="i"
                    height="72px"
                />
            </div>
            <div
                v-else-if="error"
                class="bvm-tile q-pa-md text-center"
            >
                <p>{{$t('common.something_wrong')}}</p>
                <q-btn
                    outline
                    color="primary"
                    :label="$t('nft.action_retry')"
                    @click="load()"
                />
            </div>
            <empty-state
                v-else-if="!positions.length"
                icon="o_water_drop"
                :text="$t('liquidity.msg_none')"
                :action="$t('empty.action_add_liquidity')"
                action-icon="o_open_in_new"
                @action="openURL('https://www.betterswap.io/pools')"
            />
            <template v-else>
                <div
                    v-if="totalUsd"
                    class="bvm-tile q-pa-md q-mb-md"
                >
                    <div class="text-muted">{{$t('liquidity.label_total')}}</div>
                    <div class="bvm-display total">{{money(totalUsd * fx)}}</div>
                </div>
                <q-list role="group" class="bvm-list">
                    <q-item
                        v-for="p in positions"
                        :key="p.key"
                        clickable
                        @click="openURL(p.url)"
                    >
                        <q-item-section avatar>
                            <div class="pair-icons">
                                <img
                                    v-if="p.token0.image"
                                    :src="p.token0.image"
                                    alt=""
                                >
                                <img
                                    v-if="p.token1.image"
                                    :src="p.token1.image"
                                    alt=""
                                    class="second"
                                >
                            </div>
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label class="text-weight-bold">{{p.pair}}</q-item-label>
                            <q-item-label caption>
                                {{p.dex}}
                                <template v-if="p.apy != null"> · {{$t('liquidity.label_apy', { apy: p.apy.toFixed(1) })}}</template>
                                <template v-if="p.inRange === false"> · <span class="text-warning">{{$t('liquidity.label_out_of_range')}}</span></template>
                            </q-item-label>
                            <q-item-label
                                v-if="p.amount0 || p.amount1"
                                caption
                            >{{fmt(p.amount0)}} {{p.token0.symbol}} + {{fmt(p.amount1)}} {{p.token1.symbol}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <div
                                v-if="p.usd != null"
                                class="bvm-amount text-white"
                            >{{money(p.usd * fx)}}</div>
                            <q-icon
                                v-else
                                name="o_open_in_new"
                                size="18px"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { findPositions, type Position } from 'src/utils/liquidity'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { money, prefs } from 'src/utils/prefs'
import { openURL } from 'src/utils/open-url'
import { genesises } from 'src/consts'

// the liquidity the wallet provides on BetterSwap and VeTrade
export default defineComponent({
    components: { EmptyState, PageToolbar, PageContent },
    data: () => ({
        loading: true,
        error: false,
        positions: [] as Position[],
        fx: 1
    }),
    computed: {
        totalUsd(): number {
            return this.positions.reduce((s, p) => s + (p.usd || 0), 0)
        }
    },
    created() {
        void this.load()
    },
    methods: {
        money,
        openURL,
        fmt(v: number) {
            return v.toLocaleString(undefined, { maximumFractionDigits: v >= 100 ? 0 : 4 })
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                this.fx = await this.$svc.prices.fx(prefs.currency)
                const wallets = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const chosen = selection.walletId === ALL_WALLETS ? wallets : [selectedWallet(wallets)].filter((w): w is M.Wallet => !!w)
                const addresses = [...new Set(chosen.flatMap(w => w.meta.addresses))]
                const thor = this.$svc.bc(genesises.main.id).thor
                const all = await Promise.all(addresses.map(a => findPositions(thor, a)))
                const list = all.flat()
                // V3 positions: their tokens at today's prices
                const open = list.filter(p => p.usd === null && (p.amount0 || p.amount1))
                if (open.length) {
                    const stats = await this.$svc.prices.stats(open.flatMap(p => [p.token0.address, p.token1.address])).catch(() => ({} as Record<string, { price: number }>))
                    const price = (a: string) => stats[(a || '0x0000000000000000000000000000000000000000').toLowerCase()]?.price
                    for (const p of open) {
                        const p0 = price(p.token0.address)
                        const p1 = price(p.token1.address)
                        if (p0 !== undefined || p1 !== undefined) {
                            p.usd = p.amount0 * (p0 || 0) + p.amount1 * (p1 || 0)
                        }
                    }
                }
                this.positions = list.sort((a, b) => (b.usd || 0) - (a.usd || 0))
            } catch (err) {
                console.warn('liquidity:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.total
  font-size: 28px

.pair-icons
  position: relative
  width: 44px
  height: 32px
  img
    position: absolute
    top: 0
    left: 0
    width: 30px
    height: 30px
    border-radius: 50%
    border: 2px solid $surface
  .second
    left: 14px
</style>
