<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('liquidity.title')">
            <q-btn
                v-if="owner"
                flat
                round
                icon="o_add_circle_outline"
                :aria-label="$t('liquidity.action_new')"
                @click="pickPool()"
            />
        </page-toolbar>
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
                :action-icon="owner ? 'o_add_circle_outline' : 'o_open_in_new'"
                @action="owner ? pickPool() : openURL('https://www.betterswap.io/pools')"
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
                        @click="choose(p)"
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
                            <q-item-label
                                v-if="p.vsHodl != null"
                                caption
                            >{{$t('liquidity.label_vs_hodl')}} <span :class="p.vsHodl >= 0 ? 'text-primary' : 'text-warning'">{{signed(p.vsHodl)}}</span></q-item-label>
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
                <p
                    v-if="positions.some(p => p.vsHodl != null)"
                    class="text-caption text-muted q-mt-md"
                >{{$t('liquidity.msg_vs_hodl')}}</p>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { compareToHodl, findPositions, loadPools, type Pool, type Position } from 'src/utils/liquidity'
import { routerOf } from 'src/utils/liquidity-v2'
import { canSign } from 'src/utils/watch'
import PoolDialog from './PoolDialog.vue'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { money, prefs } from 'src/utils/prefs'
import { numberLocale } from 'src/utils/format'
import { openURL } from 'src/utils/open-url'
import { genesises } from 'src/consts'

// the liquidity the wallet provides on BetterSwap and VeTrade
export default defineComponent({
    components: { EmptyState, PageToolbar, PageContent },
    data: () => ({
        loading: true,
        error: false,
        positions: [] as Position[],
        fx: 1,
        /** addresses of the chosen wallets that can sign */
        signable: [] as string[]
    }),
    computed: {
        /** where a new position comes from: the first address that can sign */
        owner(): string {
            return this.signable[0] || ''
        },
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
        /** a BetterSwap V2 position: add, take out or open; others open on their DEX */
        async choose(p: Position) {
            const src = p.source
            const pool = src?.kind === 'v2' && this.signable.includes(src.owner.toLowerCase())
                ? (await loadPools().catch(() => [] as Pool[])).find(x => x.poolAddress.toLowerCase() === src.pool.toLowerCase())
                : undefined
            if (!pool || !routerOf(pool) || src?.kind !== 'v2') {
                openURL(p.url)
                return
            }
            this.$q.bottomSheet({
                actions: [
                    { label: this.$t('liquidity.action_add'), icon: 'o_add', id: 'add' },
                    { label: this.$t('liquidity.action_remove'), icon: 'o_remove', id: 'remove' },
                    { label: this.$t('liquidity.action_open_dex'), icon: 'o_open_in_new', id: 'open' }
                ]
            }).onOk((a: { id: string }) => {
                if (a.id === 'open') openURL(p.url)
                else void this.change(pool, src.owner, a.id as 'add' | 'remove', src.balance)
            })
        },
        /** the pools with the most in them, to start a new position in */
        async pickPool() {
            const pools = (await loadPools().catch(() => [] as Pool[]))
                .filter(x => routerOf(x) && BigInt(x.reserve0?.raw || 0) > 0n && BigInt(x.reserve1?.raw || 0) > 0n)
                .sort((a, b) => (b.totalUsdValue || 0) - (a.totalUsdValue || 0))
                .slice(0, 20)
            if (!pools.length) {
                this.$q.notify(this.$t('common.something_wrong'))
                return
            }
            this.$q.dialog({
                title: this.$t('liquidity.title_pick'),
                options: {
                    type: 'radio',
                    model: pools[0]!.poolAddress,
                    items: pools.map(x => ({
                        label: `${x.token0.symbol || 'VET'}/${x.token1.symbol || 'VET'} · ${money((x.totalUsdValue || 0) * this.fx, prefs.currency, { compact: true })}${x.apy ? ` · ${this.$t('liquidity.label_apy', { apy: x.apy.toFixed(1) })}` : ''}`,
                        value: x.poolAddress
                    }))
                },
                cancel: true
            }).onOk((address: string) => {
                const pool = pools.find(x => x.poolAddress === address)
                if (pool) void this.change(pool, this.owner, 'add', 0n)
            })
        },
        async change(pool: Pool, owner: string, mode: 'add' | 'remove', lp: bigint) {
            let clauses: { to: string, value: string, data: string }[]
            try {
                clauses = await this.$dialog<{ to: string, value: string, data: string }[]>({ component: PoolDialog, pool, owner, mode, lp: lp.toString() })
            } catch {
                return
            }
            const pair = `${pool.token0.symbol || 'VET'}/${pool.token1.symbol || 'VET'}`
            const comment = this.$t(mode === 'add' ? 'liquidity.comment_add' : 'liquidity.comment_remove', { pair })
            try {
                await this.$signTx(genesises.main.id, {
                    message: clauses.map(c => ({ ...c, comment })),
                    options: { signer: owner, comment }
                })
                setTimeout(() => void this.load(), 12 * 1000)
            } catch { }
        },
        signed(v: number) {
            return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString(numberLocale(), { maximumFractionDigits: 1 })}%`
        },
        fmt(v: number) {
            return v.toLocaleString(numberLocale(), { maximumFractionDigits: v >= 100 ? 0 : 4 })
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                this.fx = await this.$svc.prices.fx(prefs.currency)
                const wallets = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const chosen = selection.walletId === ALL_WALLETS ? wallets : [selectedWallet(wallets)].filter((w): w is M.Wallet => !!w)
                const addresses = [...new Set(chosen.flatMap(w => w.meta.addresses))]
                this.signable = chosen.filter(canSign).flatMap(w => w.meta.addresses.map(a => a.toLowerCase()))
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
                // against holding: read per position, shown as each comes in
                for (const p of this.positions) {
                    compareToHodl(thor, p).then(v => { p.vsHodl = v }).catch(() => { p.vsHodl = null })
                }
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
