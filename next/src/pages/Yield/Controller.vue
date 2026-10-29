<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('yield.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('yield.msg_intro')}}</p>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 3"
                    :key="i"
                    height="96px"
                />
            </div>
            <template v-else>
                <div
                    v-if="yearly > 0"
                    class="bvm-tile q-pa-md q-mb-md"
                >
                    <div class="text-muted">{{$t('yield.label_yearly')}}</div>
                    <div class="bvm-display big">≈ {{money(yearly * fx)}}</div>
                    <div class="text-caption text-muted">{{$t('yield.msg_yearly')}}</div>
                </div>

                <!-- liquidity -->
                <q-item
                    clickable
                    class="bvm-tile source q-mb-sm"
                    :to="{ name: 'liquidity' }"
                >
                    <q-item-section avatar>
                        <q-icon
                            name="o_water_drop"
                            color="primary"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label class="text-weight-bold">{{$t('liquidity.title')}}</q-item-label>
                        <q-item-label caption>{{lp.count ? $t('yield.label_lp', { n: lp.count, apy: fixed(lp.apy) }) : $t('yield.label_none')}}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <div
                            v-if="lp.usd"
                            class="bvm-amount text-white"
                        >{{money(lp.usd * fx)}}</div>
                    </q-item-section>
                </q-item>

                <!-- StarGate -->
                <q-item
                    clickable
                    class="bvm-tile source q-mb-sm"
                    :to="{ name: 'stargate' }"
                >
                    <q-item-section avatar>
                        <q-icon
                            name="o_hub"
                            color="primary"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label class="text-weight-bold">StarGate</q-item-label>
                        <q-item-label caption>{{stake.nodes ? $t('yield.label_stake', { n: stake.nodes, vet: formatUnits(stake.staked, 18, 0) }) : $t('yield.label_none')}}</q-item-label>
                        <q-item-label
                            v-if="stake.claimable > 0n"
                            caption
                            class="text-primary"
                        >{{$t('yield.label_claimable', { vtho: formatUnits(stake.claimable, 18, 2) })}}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <div
                            v-if="stakeUsd"
                            class="bvm-amount text-white"
                        >{{money(stakeUsd * fx)}}</div>
                    </q-item-section>
                </q-item>

                <!-- VeBetterDAO -->
                <q-item
                    clickable
                    class="bvm-tile source q-mb-sm"
                    :to="{ name: 'discover' }"
                >
                    <q-item-section avatar>
                        <q-icon
                            name="o_eco"
                            color="primary"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label class="text-weight-bold">X2Earn</q-item-label>
                        <q-item-label caption>{{x2 === null ? $t('yield.label_x2_unknown') : $t('yield.label_x2', { b3tr: fixed(x2) })}}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <div
                            v-if="x2 && b3trUsd"
                            class="bvm-amount text-white"
                        >{{money(x2 * b3trUsd * fx)}}</div>
                    </q-item-section>
                </q-item>
                <p class="text-caption text-muted q-mt-md">{{$t('yield.msg_how')}}</p>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import { findPositions, type Position } from 'src/utils/liquidity'
import { stakePositions, B3TR, type StakePosition } from 'src/utils/ecosystem'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { money, prefs } from 'src/utils/prefs'
import { formatUnits, numberLocale } from 'src/utils/format'
import { serverUrl } from 'src/utils/endpoints'
import { genesises } from 'src/consts'

const ZERO = '0x0000000000000000000000000000000000000000'

// what the wallet earns, in one place: liquidity, StarGate and X2Earn
export default defineComponent({
    components: { PageToolbar, PageContent },
    data: () => ({
        loading: true,
        fx: 1,
        positions: [] as Position[],
        stakes: [] as StakePosition[],
        /** B3TR from X2Earn in the last 30 days; null without the server */
        x2: null as number | null,
        prices: {} as Record<string, number>
    }),
    computed: {
        lp(): { count: number, usd: number, apy: number } {
            const priced = this.positions.filter(p => p.usd != null)
            const usd = priced.reduce((s, p) => s + (p.usd || 0), 0)
            // the APY weighted by what's in each pool
            const apy = usd > 0 ? priced.reduce((s, p) => s + (p.usd || 0) * (p.apy || 0), 0) / usd : 0
            return { count: this.positions.length, usd, apy }
        },
        stake(): { nodes: number, staked: bigint, claimable: bigint } {
            return {
                nodes: this.stakes.length,
                staked: this.stakes.reduce((s, p) => s + p.staked, 0n),
                claimable: this.stakes.reduce((s, p) => s + p.claimable, 0n)
            }
        },
        stakeUsd(): number {
            return Number(this.stake.staked / 10n ** 15n) / 1000 * (this.prices[ZERO] || 0)
        },
        b3trUsd(): number {
            return this.prices[B3TR] || 0
        },
        /** a year at the pools' APY: what liquidity is expected to earn */
        yearly(): number {
            return this.lp.usd * this.lp.apy / 100
        }
    },
    created() {
        void this.load()
    },
    methods: {
        money,
        formatUnits,
        fixed(v: number) {
            return v.toLocaleString(numberLocale(), { maximumFractionDigits: v >= 100 ? 0 : 1 })
        },
        async load() {
            this.loading = true
            try {
                const wallets = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const chosen = selection.walletId === ALL_WALLETS ? wallets : [selectedWallet(wallets)].filter((w): w is M.Wallet => !!w)
                const addresses = [...new Set(chosen.flatMap(w => w.meta.addresses))]
                const thor = this.$svc.bc(genesises.main.id).thor
                const [fx, positions, stakes, stats, x2] = await Promise.all([
                    this.$svc.prices.fx(prefs.currency).catch(() => 1),
                    Promise.all(addresses.map(a => findPositions(thor, a).catch(() => []))).then(l => l.flat()),
                    Promise.all(addresses.map(a => stakePositions(thor, a).catch(() => []))).then(l => l.flat()),
                    this.$svc.prices.stats([null, B3TR]).catch(() => ({} as Record<string, { price: number }>)),
                    this.x2Earned(addresses)
                ])
                this.fx = fx
                this.positions = positions
                this.stakes = stakes
                this.x2 = x2
                this.prices = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k.toLowerCase(), v.price]))
            } finally {
                this.loading = false
            }
        },
        /** the server's leaderboard knows each address's last 30 days */
        async x2Earned(addresses: string[]): Promise<number | null> {
            if (serverUrl === null || !addresses.length) return null
            try {
                const all = await Promise.all(addresses.slice(0, 10).map(async a => {
                    const r = await fetch(`${serverUrl}/x2earn/leaderboard?days=30&address=${a}`)
                    if (!r.ok) throw new Error(String(r.status))
                    const b = await r.json() as { you: { b3tr: number } | null }
                    return b.you?.b3tr || 0
                }))
                return all.reduce((s, v) => s + v, 0)
            } catch {
                return null
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.big
  font-size: 28px

.source
  padding: 12px 14px
</style>
