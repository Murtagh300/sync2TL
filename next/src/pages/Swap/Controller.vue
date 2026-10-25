<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="$t('swap.title')"
            :gid="wallet?.gid"
        >
            <q-btn
                flat
                round
                icon="o_tune"
            >
                <q-menu
                    anchor="bottom right"
                    self="top right"
                >
                    <q-list style="min-width: 200px">
                        <q-item-label header>{{$t('swap.label_slippage')}}</q-item-label>
                        <q-item
                            v-for="bps in [50, 100, 200, 500]"
                            :key="bps"
                            v-close-popup
                            clickable
                            :active="slippageBps === bps"
                            @click="slippageBps = bps"
                        >
                            <q-item-section>{{bps / 100}}%</q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
        </page-toolbar>
        <page-content
            v-if="wallet"
            class="col"
            padding
        >
            <!-- pay -->
            <div class="bvm-tile swap-box">
                <div class="row items-center text-muted swap-box-head">
                    <span>{{$t('swap.label_pay')}}</span>
                    <q-space />
                    <span v-if="fromBalance !== null">{{$t('swap.label_balance')}} {{formatUnits(fromBalance, fromToken?.decimals || 18)}}</span>
                    <q-btn
                        v-if="fromBalance"
                        flat
                        dense
                        no-caps
                        color="primary"
                        size="sm"
                        :label="$t('swap.action_max')"
                        @click="setMax()"
                    />
                </div>
                <div class="row no-wrap items-center">
                    <q-input
                        v-model="amount"
                        class="col"
                        borderless
                        inputmode="decimal"
                        placeholder="0"
                        input-class="bvm-display swap-amount"
                        :error="!!amountError"
                        hide-bottom-space
                    />
                    <token-pick
                        v-model="fromSymbol"
                        :tokens="tokens"
                    />
                </div>
                <div
                    v-if="amountError"
                    class="text-negative swap-error"
                >{{amountError}}</div>
            </div>

            <div class="row justify-center">
                <q-btn
                    round
                    unelevated
                    class="flip"
                    icon="swap_vert"
                    @click="flip()"
                />
            </div>

            <!-- receive -->
            <div class="bvm-tile swap-box">
                <div class="row items-center text-muted swap-box-head">
                    <span>{{$t('swap.label_receive')}}</span>
                </div>
                <div class="row no-wrap items-center">
                    <div class="col bvm-display swap-amount swap-out ellipsis">
                        <q-spinner-dots
                            v-if="quoting"
                            size="24px"
                        />
                        <template v-else>{{quoteResult ? formatUnits(quoteResult.amountOut, toToken?.decimals || 18) : '0'}}</template>
                    </div>
                    <token-pick
                        v-model="toSymbol"
                        :tokens="tokens"
                    />
                </div>
            </div>

            <div
                v-if="quoteResult"
                class="q-mt-md q-px-xs details"
            >
                <div class="row">
                    <span class="text-muted">{{$t('swap.label_rate')}}</span>
                    <q-space />
                    <span>1 {{fromSymbol}} ≈ {{rate}} {{toSymbol}}</span>
                </div>
                <div class="row">
                    <span class="text-muted">{{$t('swap.label_min')}}</span>
                    <q-space />
                    <span>{{formatUnits(quoteResult.amountOutMin, toToken?.decimals || 18)}} {{toSymbol}}</span>
                </div>
                <div class="row">
                    <span class="text-muted">{{$t('swap.label_route')}}</span>
                    <q-space />
                    <span>{{quoteResult.source}} · {{slippageBps / 100}}%</span>
                </div>
            </div>
            <div
                v-if="quoteError"
                class="text-negative q-mt-md text-center"
            >{{quoteError}}</div>
        </page-content>
        <page-action v-if="wallet">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_swap_vert"
                :disable="!quoteResult || quoting || !!amountError"
                :label="$t('swap.action_swap')"
                @click="swap()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import TokenPick from './TokenPick.vue'
import { quote, type Quote } from 'src/utils/swap'
import { formatUnits, toWei } from 'src/utils/format'
import { BigNumber } from 'bignumber.js'
import { visibleTokens } from 'src/utils/tokens'
import { genesises } from 'src/consts'

// swap tokens through the VeChain DEXes
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, TokenPick },
    props: {
        wid: String,
        i: String
    },
    data: () => ({
        fromSymbol: 'VET',
        toSymbol: 'VTHO',
        amount: '',
        slippageBps: 100,
        quoting: false,
        quoteResult: null as Quote | null,
        quoteError: '',
        fromBalance: null as bigint | null,
        controller: null as AbortController | null,
        timer: 0 as ReturnType<typeof setTimeout> | 0,
        // async computed (see src/shims-async-computed.d.ts)
        wallet: null as M.Wallet | null,
        tokens: [] as M.TokenSpec[]
    }),
    asyncComputed: {
        async wallet(): Promise<M.Wallet | null> {
            if (this.wid) {
                return this.$svc.wallet.get(parseInt(this.wid))
            }
            // from the menu: the first wallet on mainnet
            const [first] = await this.$svc.wallet.getByGid(genesises.main.id)
            return first || null
        },
        tokens: {
            async get(): Promise<M.TokenSpec[]> {
                const w = this.wallet
                if (!w) {
                    return []
                }
                // held tokens first, then everything in the registry
                const [held, all] = await Promise.all([
                    visibleTokens(this.$svc, w.gid, this.address),
                    this.$svc.config.token.all()
                ])
                const rest = all.filter(t => t.gid === w.gid && !held.some(h => h.symbol === t.symbol))
                return [...held, ...rest]
            },
            default: []
        }
    },
    computed: {
        address(): string {
            return this.wallet?.meta.addresses[parseInt(this.i || '0')] || ''
        },
        fromToken(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.fromSymbol)
        },
        toToken(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.toSymbol)
        },
        amountWei(): bigint | null {
            const a = this.amount.trim().replace(',', '.')
            if (!/^\d+(\.\d+)?$/.test(a) || !this.fromToken) {
                return null
            }
            const wei = BigInt(toWei(a, this.fromToken.decimals))
            return wei > 0n ? wei : null
        },
        amountError(): string {
            if (!this.amount.trim()) {
                return ''
            }
            if (this.amountWei === null) {
                return this.$t('send.msg_invalid_amount')
            }
            if (this.fromBalance !== null && this.amountWei > this.fromBalance) {
                return this.$t('swap.msg_insufficient', { symbol: this.fromSymbol })
            }
            return ''
        },
        rate(): string {
            const q = this.quoteResult
            if (!q || !this.amountWei || !this.fromToken || !this.toToken) {
                return ''
            }
            const out = new BigNumber(q.amountOut.toString()).div(new BigNumber(10).pow(this.toToken.decimals))
            const inp = new BigNumber(this.amountWei.toString()).div(new BigNumber(10).pow(this.fromToken.decimals))
            return out.div(inp).toFormat(6).replace(/\.?0+$/, '')
        }
    },
    watch: {
        fromSymbol() { this.loadBalance(); this.requote() },
        toSymbol() { this.requote() },
        amount() { this.requote() },
        slippageBps() { this.requote() },
        address() { this.loadBalance() },
        tokens() { this.loadBalance() }
    },
    methods: {
        formatUnits,
        async loadBalance() {
            const w = this.wallet
            const t = this.fromToken
            this.fromBalance = null
            if (!w || !t || !this.address) {
                return
            }
            try {
                const b = await this.$svc.bc(w.gid).balanceOf(this.address, t)
                this.fromBalance = BigInt(new BigNumber(b).toFixed(0))
            } catch { }
        },
        setMax() {
            const t = this.fromToken
            if (!t || this.fromBalance === null) {
                return
            }
            // keep some VET? VET pays no gas on VeChain; VTHO does, so leave a little VTHO
            let max = this.fromBalance
            if (t.symbol === 'VTHO') {
                const reserve = 20n * 10n ** 18n
                max = max > reserve ? max - reserve : 0n
            }
            this.amount = new BigNumber(max.toString()).div(new BigNumber(10).pow(t.decimals)).toFixed()
        },
        flip() {
            const f = this.fromSymbol
            this.fromSymbol = this.toSymbol
            this.toSymbol = f
        },
        requote() {
            this.quoteResult = null
            this.quoteError = ''
            this.controller?.abort()
            this.timer && clearTimeout(this.timer)
            if (!this.amountWei || this.amountError || this.fromSymbol === this.toSymbol || !this.wallet) {
                this.quoting = false
                return
            }
            this.quoting = true
            this.timer = setTimeout(() => void this.fetchQuote(), 450)
        },
        async fetchQuote() {
            const w = this.wallet
            const amountWei = this.amountWei
            if (!w || !amountWei) {
                return
            }
            const controller = new AbortController()
            this.controller = controller
            try {
                const q = await quote(this.$svc.bc(w.gid).thor, this.fromToken?.address, this.toToken?.address,
                    amountWei, this.slippageBps, this.address, controller.signal)
                if (!controller.signal.aborted) {
                    this.quoteResult = q
                }
            } catch {
                if (!controller.signal.aborted) {
                    this.quoteError = this.$t('swap.msg_no_route')
                }
            } finally {
                if (!controller.signal.aborted) {
                    this.quoting = false
                }
            }
        },
        async swap() {
            const w = this.wallet
            const q = this.quoteResult
            if (!w || !q) {
                return
            }
            const comment = this.$t('swap.comment', {
                amount: this.amount, from: this.fromSymbol,
                out: formatUnits(q.amountOut, this.toToken?.decimals || 18), to: this.toSymbol
            })
            try {
                await this.$signTx(w.gid, {
                    message: q.clauses.map(c => ({ ...c, comment })),
                    options: { signer: this.address, comment }
                })
                this.$q.notify(this.$t('swap.msg_done'))
                this.amount = ''
                setTimeout(() => this.loadBalance(), 12 * 1000)
            } catch {
                // declined in the transaction dialog
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.swap-box
  padding: 12px 16px

.swap-box-head
  font-size: 13px
  font-weight: 700
  min-height: 28px

:deep(.swap-amount),
.swap-amount
  font-size: 30px !important

.swap-out
  min-height: 48px
  line-height: 48px

.swap-error
  font-size: 12px

.flip
  margin: -10px 0
  z-index: 1
  border: 1px solid $hairline-2
  background: $surface-2

.details
  font-size: 13px
  > div
    padding: 3px 0
</style>
