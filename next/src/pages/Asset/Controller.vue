<template>
    <div
        class="fit column no-wrap"
        v-if="wallet"
    >
        <page-toolbar
            :title="token ? token.name : $t('asset.title')"
            :gid="wallet.gid"
        />
        <page-content>
            <async-resolve
                v-if="token"
                :promise="$svc.bc(token.gid).balanceOf(address, token)"
                v-slot={data}
            >
                <head-item
                    :token="token"
                    :balance="data"
                >
                    <div class="text-weight-bold">{{token.symbol}}</div>
                    <!-- the wallet's name may shorten; the address never does -->
                    <div
                        class="text-muted row no-wrap items-center asset-owner"
                    >
                        <span class="ellipsis">{{wallet.meta.name}}</span>
                        <span class="q-mx-xs">·</span>
                        <address-label
                            compact
                            no-icon
                            class="asset-address"
                            :addr="address"
                        />
                    </div>
                    <template #balance>
                        <div class="asset-balance bvm-display ellipsis">
                            <amount-label
                                :value="data"
                                :decimals="token.decimals"
                            >--.--</amount-label>
                        </div>
                        <div class="asset-symbol">
                            {{token.symbol}}<template v-if="unitPrice"> · <span class="bvm-amount">{{money(units(data) * unitPrice)}}</span></template>
                        </div>
                    </template>
                    <template
                        v-if="signable"
                        #action
                    >
                        <q-btn
                            unelevated
                            no-caps
                            color="primary"
                            icon="o_north_east"
                            class="full-width q-mt-md"
                            :label="$t('send.action_send')"
                            :to="{name: 'send', query: { wid: walletId, i: addressIndex, symbol: symbol }}"
                        />
                    </template>
                </head-item>
            </async-resolve>
            <div
                v-if="token && charted"
                class="bvm-tile q-mx-md q-mt-md q-pa-md"
            >
                <price-chart
                    :token="token"
                    :marks="marks"
                    :costPrice="position ? position.avgFiat : 0"
                />
                <!-- what you paid on average (in VET, from your swaps and buys) against now -->
                <div
                    v-if="position"
                    class="position row no-wrap items-center q-mt-md"
                >
                    <div class="col">
                        <div class="text-muted position-label">{{$t('asset.label_avg_buy')}}</div>
                        <div class="bvm-amount">{{money(position.avgFiat)}} <span class="text-muted position-vet">· {{position.avgVet.toLocaleString($i18n.locale, { maximumSignificantDigits: 4 })}} VET</span></div>
                        <div class="text-muted position-label">{{$t('asset.msg_buys', { n: position.buys })}}</div>
                    </div>
                    <div
                        class="position-pct bvm-amount"
                        :class="position.pct >= 0 ? 'text-primary' : 'text-negative'"
                    >{{position.pct >= 0 ? '+' : ''}}{{$fixed(position.pct, 1)}}%</div>
                </div>
            </div>
            <token-info
                v-if="token && wallet.gid === mainGid"
                :token="token"
            />
            <div class="bvm-label q-px-md q-pt-lg q-pb-sm">{{$t('asset.label_history')}}</div>
        </page-content>
        <page-content class="col">
            <Logs
                v-if="token"
                :address="address"
                :token="token"
                :pageSize="20"
                @logs="onLogs"
            />
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Logs from './Logs.vue'
import HeadItem from './HeadItem.vue'
import AsyncResolve from 'components/AsyncResolve'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import AmountLabel from 'components/AmountLabel.vue'
import PriceChart, { type ChartMark } from './PriceChart.vue'
import TokenInfo from './TokenInfo.vue'
import { genesises } from 'src/consts'
import type { TransferLogItem } from './models'
import { BigNumber } from 'bignumber.js'
import { money, prefs } from 'src/utils/prefs'
import { canSign } from 'src/utils/watch'
import { flows } from 'src/utils/overview'
import { costBasis, VVET } from 'src/utils/cost-basis'
export default defineComponent({
    components: {
        TokenInfo,
        Logs,
        HeadItem,
        AsyncResolve,
        PageToolbar,
        PageContent,
        AddressLabel,
        AmountLabel,
        PriceChart
    },
    data() {
        return {
            showQR: false,
            mainGid: genesises.main.id,
            marks: [] as ChartMark[],
            /** the price of one token in the chosen currency; 0 when unknown */
            unitPrice: 0,
            /** what this address paid for the token on average, against now; null without buys */
            position: null as { avgVet: number, avgFiat: number, pct: number, buys: number } | null,
            // async computed (see src/shims-async-computed.d.ts)
            wallet: null as M.Wallet | null,
            token: null as M.TokenSpec | null
        }
    },
    props: {
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true },
        symbol: { type: String, required: true }
    },
    asyncComputed: {
        wallet(): Promise<M.Wallet | null> {
            return this.$svc.wallet.get(parseInt(this.walletId))
        },
        token: {
            async get(): Promise<M.TokenSpec | null> {
                const wallet = this.wallet
                if (!wallet) {
                    return null
                }
                // any token of the network: also the ones found on the address, not switched on
                const tokens = await this.$svc.config.token.all()
                return tokens.find(token => token.gid === wallet.gid && token.symbol === this.symbol) || null
            },
            default: null
        }
    },
    watch: {
        token: {
            async handler(t: M.TokenSpec | null) {
                this.unitPrice = 0
                if (!t || !this.$svc.bvm.supports(t.gid)) return
                const [stats, fx] = await Promise.all([this.$svc.prices.stats([t.address]).catch(() => ({})), this.$svc.prices.fx(prefs.currency)])
                const s = (stats as Record<string, { price: number }>)[(t.address || '0x0000000000000000000000000000000000000000').toLowerCase()]
                this.unitPrice = s ? s.price * fx : 0
                void this.loadPosition(t)
            },
            immediate: true
        }
    },
    methods: {
        money,
        /** a balance in whole tokens, for its value */
        units(balance: string): number {
            return this.token ? new BigNumber(balance || '0').div(new BigNumber(10).pow(this.token.decimals)).toNumber() : 0
        },
        /** the average cost from a year of this address's swaps and buys (VET in, token out) */
        async loadPosition(t: M.TokenSpec) {
            this.position = null
            const token = (t.address || '').toLowerCase()
            if (!token || token === VVET || !this.address) return
            try {
                const thor = this.$svc.bc(t.gid).thor
                const now = Date.now()
                const list = await flows(thor, [this.address], now - 365 * 24 * 3600 * 1000, now)
                const e = costBasis(list, a => a === token ? t.decimals : 18).find(x => x.token === token)
                if (!e || e.buys === 0 || e.qty <= 0) return
                const ZERO = '0x0000000000000000000000000000000000000000'
                const [stats, fx] = await Promise.all([this.$svc.prices.stats([ZERO, token]), this.$svc.prices.fx(prefs.currency)])
                const vetUsd = stats[ZERO]?.price || 0
                const tokenUsd = stats[token]?.price || 0
                if (!vetUsd || !tokenUsd) return
                const avgVet = e.cost / e.qty
                const nowVet = tokenUsd / vetUsd
                this.position = { avgVet, avgFiat: avgVet * vetUsd * fx, pct: (nowVet / avgVet - 1) * 100, buys: e.buys }
            } catch {
                // no history: no line
            }
        },
        onLogs(logs: TransferLogItem[]) {
            this.marks = logs.map(l => ({ time: l.meta.blockTimestamp * 1000, direction: l.direction }))
        }
    },
    computed: {
        /** prices are for mainnet */
        charted(): boolean {
            return !!this.wallet && this.$svc.bvm.supports(this.wallet.gid)
        },
        address(): string {
            return this.wallet ? (this.wallet.meta.addresses[parseInt(this.addressIndex)] ?? '') : ''
        },
        /** a watch-only wallet can't send */
        signable(): boolean {
            return canSign(this.wallet)
        }
    }
})
</script>
<style lang="sass" scoped>
.asset-balance
  font-size: clamp(40px, 12vw, 56px)

.position
  padding-top: 12px
  border-top: 1px solid $hairline

.position-label
  font-size: 12px

.position-vet
  font-size: 12px
  font-weight: 600

.position-pct
  font-size: 20px

.asset-owner
  font-size: 12px
  min-width: 0

.asset-address
  flex: none

.asset-symbol
  margin-top: 4px
  font-size: 13px
  font-weight: 800
  color: $text-soft
</style>
