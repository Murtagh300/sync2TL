<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('overview.title')">
            <q-btn
                flat
                round
                icon="o_picture_as_pdf"
                :aria-label="$t('overview.action_year_pdf', { year })"
                :disable="loading || printing"
                @click="printYear()"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <!-- which month -->
            <div class="row no-wrap items-center justify-between q-mb-md">
                <q-btn
                    flat
                    round
                    icon="chevron_left"
                    :aria-label="$t('overview.action_prev')"
                    @click="shift(-1)"
                />
                <div class="bvm-display period">{{periodLabel}}</div>
                <q-btn
                    flat
                    round
                    icon="chevron_right"
                    :aria-label="$t('overview.action_next')"
                    :disable="isCurrentMonth"
                    @click="shift(1)"
                />
            </div>

            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 4"
                    :key="i"
                    height="84px"
                />
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <template v-else>
                <!-- in and out -->
                <div class="row q-col-gutter-sm">
                    <div
                        v-for="side in sides"
                        :key="side.dir"
                        class="col-6"
                    >
                        <div class="bvm-tile tile">
                            <div class="row items-center text-muted tile-label">
                                <q-icon
                                    :name="side.dir === 'in' ? 'o_south_west' : 'o_north_east'"
                                    size="16px"
                                    class="q-mr-xs"
                                />{{$t(side.dir === 'in' ? 'overview.label_in' : 'overview.label_out')}}
                            </div>
                            <div class="bvm-amount tile-value">{{side.fiat === null ? '–' : money(side.fiat)}}</div>
                            <div
                                v-for="t in side.tokens.slice(0, 3)"
                                :key="t.symbol"
                                class="text-caption text-muted ellipsis"
                            ><span class="bvm-private">{{t.amount}}</span> {{t.symbol}}</div>
                            <div
                                v-if="!side.tokens.length"
                                class="text-caption text-muted"
                            >{{$t('overview.label_nothing')}}</div>
                        </div>
                    </div>
                </div>

                <!-- fees -->
                <div class="bvm-tile tile q-mt-sm row no-wrap items-center">
                    <q-icon
                        name="o_local_gas_station"
                        size="26px"
                        color="primary"
                    />
                    <div class="col q-ml-md">
                        <div class="text-muted tile-label">{{$t('overview.label_fees')}}<help-tip term="gas" /></div>
                        <div class="bvm-amount">{{fees.vtho}} VTHO <span
                            v-if="fees.fiat !== null"
                            class="text-muted text-weight-regular"
                        >≈ {{money(fees.fiat)}}</span></div>
                        <div class="text-caption text-muted">{{$t('overview.label_fee_count', { n: fees.count })}}</div>
                    </div>
                </div>

                <!-- NFT sales -->
                <div class="bvm-tile tile q-mt-sm row no-wrap items-center">
                    <q-icon
                        name="o_sell"
                        size="26px"
                        color="primary"
                    />
                    <div class="col q-ml-md">
                        <div class="text-muted tile-label">{{$t('overview.label_sales')}}</div>
                        <template v-if="sales.count">
                            <div class="bvm-amount">{{$t('overview.label_sales_count', { n: sales.count })}}</div>
                            <div class="text-caption text-muted">{{$t('overview.label_best_sale', { amount: sales.best })}}</div>
                        </template>
                        <div
                            v-else
                            class="text-caption text-muted"
                        >{{$t('overview.label_no_sales')}}</div>
                    </div>
                </div>

                <!-- the value at the start and the end -->
                <div
                    v-if="valueChange"
                    class="bvm-tile tile q-mt-sm"
                >
                    <div class="text-muted tile-label">{{$t('overview.label_value')}}</div>
                    <div class="row items-baseline q-gutter-x-sm">
                        <span class="bvm-amount">{{money(valueChange.start)}}</span>
                        <q-icon name="arrow_forward" />
                        <span class="bvm-amount">{{money(valueChange.end)}}</span>
                        <span :class="valueChange.end >= valueChange.start ? 'text-primary' : 'text-negative'">{{valueChange.pct}}</span>
                    </div>
                </div>

                <p class="text-caption text-muted q-mt-md">{{$t('overview.msg_prices_now')}}</p>
                <q-btn
                    outline
                    no-caps
                    color="primary"
                    icon="o_picture_as_pdf"
                    class="full-width q-mt-sm"
                    :loading="printing"
                    :label="$t('overview.action_year_pdf', { year })"
                    @click="printYear()"
                />
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import HelpTip from 'components/HelpTip.vue'
import { feesPaid, flows, monthRange, nftSales, totals, yearRange, ZERO, type Flow } from 'src/utils/overview'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { dayValues } from 'src/utils/value-history'
import { money, prefs } from 'src/utils/prefs'
import { formatUnits } from 'src/utils/format'
import { printTable, type ExportRow } from 'src/utils/export'
import { genesises } from 'src/consts'
import type { Prices } from 'boot/services/prices'

const ENERGY = '0x0000000000000000000000000000456e65726779'

type Side = { dir: 'in' | 'out', fiat: number | null, tokens: { symbol: string, amount: string }[] }

// a month of the wallet: in, out, fees, NFT sales, value; and the year as a printable list
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, HelpTip },
    data: () => {
        const now = new Date()
        return {
            year: now.getFullYear(),
            month: now.getMonth(),
            loading: true,
            error: false,
            printing: false,
            list: [] as Flow[],
            feeWei: 0n,
            feeCount: 0,
            wallets: [] as M.Wallet[],
            tokens: [] as M.TokenSpec[],
            stats: {} as Record<string, Prices.Stat>,
            fx: 1
        }
    },
    computed: {
        periodLabel(): string {
            const s = new Date(this.year, this.month, 1).toLocaleDateString(this.$i18n.locale, { month: 'long', year: 'numeric' })
            return s.charAt(0).toUpperCase() + s.slice(1)
        },
        isCurrentMonth(): boolean {
            const now = new Date()
            return this.year === now.getFullYear() && this.month === now.getMonth()
        },
        chosen(): M.Wallet[] {
            const main = this.wallets.filter(w => w.gid === genesises.main.id)
            if (selection.walletId === ALL_WALLETS) return main
            const w = selectedWallet(main)
            return w ? [w] : []
        },
        addresses(): string[] {
            return [...new Set(this.chosen.flatMap(w => w.meta.addresses.map(a => a.toLowerCase())))]
        },
        sides(): Side[] {
            const t = totals(this.list)
            return (['in', 'out'] as const).map(dir => {
                let fiat: number | null = 0
                const rows = t.filter(x => x[dir] > 0n).map(x => {
                    const spec = this.spec(x.token)
                    const units = this.units(x[dir], spec?.decimals ?? 18)
                    const price = this.stats[x.token]?.price
                    if (price !== undefined && fiat !== null) fiat += units * price * this.fx
                    return { symbol: spec?.symbol || `${x.token.slice(0, 6)}…`, amount: formatUnits(x[dir], spec?.decimals ?? 18, 2), value: price !== undefined ? units * price : -1 }
                }).sort((a, b) => b.value - a.value)
                return { dir, fiat: rows.length ? fiat : 0, tokens: rows }
            })
        },
        fees(): { vtho: string, fiat: number | null, count: number } {
            const price = this.stats[ENERGY]?.price
            const units = this.units(this.feeWei, 18)
            return { vtho: formatUnits(this.feeWei, 18, 2), fiat: price !== undefined ? units * price * this.fx : null, count: this.feeCount }
        },
        sales(): { count: number, best: string } {
            const s = nftSales(this.list)
            let best = ''
            let bestValue = -1
            for (const f of s) {
                const spec = this.spec(f.token)
                const units = this.units(f.amount, spec?.decimals ?? 18)
                const value = units * (this.stats[f.token]?.price ?? 0)
                if (value > bestValue) {
                    bestValue = value
                    best = `${formatUnits(f.amount, spec?.decimals ?? 18, 2)} ${spec?.symbol || ''}`
                }
            }
            return { count: s.length, best }
        },
        /** from the values kept per day (Portfolio): the first and last of the month */
        valueChange(): { start: number, end: number, pct: string } | null {
            const scope = selection.walletId === ALL_WALLETS ? 'all' : String(this.chosen[0]?.id ?? '')
            const prefix = `${this.year}-${String(this.month + 1).padStart(2, '0')}`
            const days = dayValues(scope).filter(d => d.day.startsWith(prefix))
            if (days.length < 2) return null
            const start = days[0]!.usd * this.fx
            const end = days[days.length - 1]!.usd * this.fx
            const pct = start > 0 ? `${end >= start ? '+' : ''}${((end / start - 1) * 100).toFixed(1)}%` : ''
            return { start, end, pct }
        }
    },
    watch: {
        addresses() { void this.load() }
    },
    async created() {
        const [wallets, tokens] = await Promise.all([this.$svc.wallet.all(), this.$svc.config.token.all()])
        this.tokens = tokens.filter(t => t.gid === genesises.main.id)
        this.wallets = wallets
        if (!this.addresses.length) {
            this.loading = false
        }
    },
    methods: {
        money(v: number) {
            return money(v)
        },
        units(wei: bigint, decimals: number) {
            return new BigNumber(wei.toString()).div(new BigNumber(10).pow(decimals)).toNumber()
        },
        spec(token: string): M.TokenSpec | undefined {
            return this.tokens.find(t => (t.address || ZERO).toLowerCase() === token)
        },
        shift(by: number) {
            const d = new Date(this.year, this.month + by, 1)
            this.year = d.getFullYear()
            this.month = d.getMonth()
            void this.load()
        },
        async load() {
            if (!this.addresses.length) return
            this.loading = true
            this.error = false
            try {
                const thor = this.$svc.bc(genesises.main.id).thor
                const [from, to] = monthRange(this.year, this.month)
                const list = await flows(thor, this.addresses, from, to)
                const mine = new Set(this.addresses)
                // fees: transactions these addresses signed, from the chain and from this app
                const activity = (await this.$svc.activity.page(1000, 0))
                    .filter(a => a.type === 'tx' && a.createdTime >= from && a.createdTime <= to && mine.has(a.glob.signer.toLowerCase()))
                    .map(a => a.glob.id)
                const signed = [...list.filter(f => mine.has(f.origin)).map(f => f.txId), ...activity]
                const [fees, stats, fx] = await Promise.all([
                    feesPaid(thor, this.addresses, signed),
                    this.$svc.prices.stats([...new Set([...list.map(f => f.token), ENERGY])]).catch(() => ({})),
                    this.$svc.prices.fx(prefs.currency)
                ])
                this.list = list
                this.feeWei = fees.vtho
                this.feeCount = fees.count
                this.stats = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k.toLowerCase(), v]))
                this.fx = fx
            } catch (err) {
                console.warn('overview:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        /** every transfer of the year, with its value at the time where prices reach back (30 days) */
        async printYear() {
            if (!this.addresses.length) return
            this.printing = true
            try {
                const thor = this.$svc.bc(genesises.main.id).thor
                const [from, to] = yearRange(this.year)
                const list = await flows(thor, this.addresses, from, to)
                const history = await this.$svc.prices.history([...new Set(list.map(f => f.token))], 720).catch(() => ({} as Record<string, Prices.Point[]>))
                const priceAt = (token: string, t: number) => {
                    const pts = history[token] || []
                    if (!pts.length || t < pts[0]!.time - 3600 * 1000) return null
                    let p = pts[0]!.price
                    for (const x of pts) {
                        if (x.time > t) break
                        p = x.price
                    }
                    return p
                }
                const rows: ExportRow[] = list.map(f => {
                    const spec = this.spec(f.token)
                    const decimals = spec?.decimals ?? 18
                    const price = priceAt(f.token, f.time)
                    return {
                        time: f.time,
                        type: this.$t(f.dir === 'in' ? 'export.type_in' : 'export.type_out'),
                        title: spec?.symbol || f.token,
                        amount: `${f.dir === 'in' ? '+' : '−'}${formatUnits(f.amount, decimals, 6)} ${spec?.symbol || ''}`,
                        counterparty: f.counterparty,
                        txId: f.txId,
                        note: '',
                        value: price !== null ? (this.units(f.amount, decimals) * price * this.fx).toFixed(2) : ''
                    }
                })
                const headers = [
                    this.$t('export.col_date'), this.$t('export.col_type'), this.$t('export.col_what'), this.$t('export.col_amount'),
                    this.$t('export.col_counterparty'), this.$t('export.col_tx'), this.$t('export.col_note'),
                    this.$t('export.col_value', { currency: prefs.currency })
                ]
                const title = this.$t('overview.title_year', { year: this.year, n: rows.length })
                if (!printTable(title, rows, headers)) {
                    this.$q.notify(this.$t('export.msg_popup'))
                }
            } catch (err) {
                console.warn('year overview:', err)
                this.$q.notify({ message: this.$t('common.something_wrong'), color: 'negative' })
            } finally {
                this.printing = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.period
  font-size: 22px

.tile
  padding: 12px 14px

.tile-label
  font-size: 12px
  font-weight: 700

.tile-value
  font-size: 20px
  margin: 2px 0 4px
</style>
