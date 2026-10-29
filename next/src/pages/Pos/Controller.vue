<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('pos.title')" />
        <page-content
            class="col"
            padding
        >
            <!-- waiting for, or got, the payment -->
            <div
                v-if="request"
                class="column items-center text-center"
            >
                <template v-if="request.paid">
                    <q-icon
                        name="check_circle"
                        color="primary"
                        size="96px"
                        class="q-mt-lg"
                    />
                    <div class="bvm-display paid-title q-mt-md">{{$t('pos.title_paid')}}</div>
                    <div class="bvm-amount q-mt-sm">{{request.amount}} {{request.symbol}} · {{fiatText(request)}}</div>
                    <div class="text-muted q-mt-xs">{{$t('payments.label_paid_by')}} <address-label :addr="request.paid.from" /></div>
                </template>
                <template v-else>
                    <div class="bvm-display due q-mt-sm">{{fiatText(request)}}</div>
                    <div class="bvm-amount text-soft q-mb-md">{{request.amount}} {{request.symbol}}</div>
                    <div class="qr bvm-tile">
                        <q-r-code :key="link">{{link}}</q-r-code>
                    </div>
                    <div class="row items-center no-wrap q-mt-md text-muted">
                        <q-spinner-dots
                            size="20px"
                            class="q-mr-sm"
                        />{{$t('pos.msg_waiting')}}
                    </div>
                    <p class="text-caption text-muted q-mt-sm hint">{{$t('pos.msg_scan')}}</p>
                </template>
            </div>

            <!-- typing the price -->
            <template v-else>
                <q-select
                    v-if="addresses.length > 1"
                    v-model="address"
                    :options="addresses"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('pos.label_address')"
                    class="q-mb-md"
                />
                <div class="text-center q-my-md">
                    <div class="bvm-display price">{{priceText}}</div>
                    <div class="text-muted preview">{{preview ? `≈ ${preview} ${symbol}` : ''}}</div>
                </div>
                <div class="row justify-center q-gutter-sm q-mb-md">
                    <q-chip
                        v-for="s in symbols"
                        :key="s"
                        clickable
                        :outline="s !== symbol"
                        :color="s === symbol ? 'primary' : undefined"
                        :text-color="s === symbol ? 'dark' : undefined"
                        @click="symbol = s"
                    >{{s}}</q-chip>
                </div>
                <div class="keypad">
                    <q-btn
                        v-for="k in keys"
                        :key="k"
                        flat
                        no-caps
                        class="key"
                        :icon="k === 'back' ? 'o_backspace' : undefined"
                        :label="k === 'back' ? undefined : k === '.' ? decimal : k"
                        :aria-label="k === 'back' ? $t('pos.a11y_back') : undefined"
                        @click="press(k)"
                    />
                </div>
                <div
                    v-if="noPrice"
                    class="text-warning text-center q-mt-sm"
                >{{$t('pos.msg_no_price', { symbol })}}</div>
            </template>
        </page-content>
        <page-action v-if="address">
            <template v-if="request">
                <q-btn
                    v-if="request.paid"
                    outline
                    no-caps
                    color="primary"
                    icon="o_receipt_long"
                    class="q-mb-sm"
                    :label="$t('receipt.action')"
                    @click="bon(request)"
                />
                <q-btn
                    unelevated
                    no-caps
                    size="lg"
                    color="primary"
                    :label="request.paid ? $t('pos.action_next') : $t('pos.action_cancel')"
                    @click="reset()"
                />
            </template>
            <q-btn
                v-else
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_qr_code_2"
                :disable="!preview"
                :label="$t('pos.action_charge')"
                @click="charge()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import AddressLabel from 'components/AddressLabel.vue'
import QRCode from 'components/QRCode.vue'
import { genesises, urls } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { decimalSeparator, numberLocale } from 'src/utils/format'
import { prefs, haptic } from 'src/utils/prefs'
import { playChime } from 'src/utils/sound'
import { incomingTransfers } from 'src/utils/incoming'
import { buildPaymentLink } from 'src/utils/payment-request'
import { matchPaidRequests, newId, payments, type PaymentRequestRecord } from 'src/utils/payments'
import { keypad, tillAmount } from 'src/utils/pos'
import { printReceipt } from 'src/utils/receipt'

const ZERO = '0x0000000000000000000000000000000000000000'

/** a request from the till, with the price it was asked at */
type TillRequest = PaymentRequestRecord & { fiat: number, currency: string }

// a till for a shop or a market stall: type the price, show the QR code, see it paid
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel, QRCode },
    data: () => ({
        wallets: [] as M.Wallet[],
        tokens: [] as M.TokenSpec[],
        address: '',
        typed: '',
        symbol: 'VET',
        prices: {} as Record<string, number>,
        fx: 1,
        request: null as TillRequest | null,
        poll: null as ReturnType<typeof setInterval> | null,
        keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'],
        decimal: decimalSeparator()
    }),
    computed: {
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id)
                .flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        /** what a till takes: VET, B3TR and the stable coins the wallet knows */
        symbols(): string[] {
            const known = this.tokens.map(t => t.symbol)
            return ['VET', 'B3TR', ...known.filter(s => /USD|EUR/i.test(s))].filter((s, i, all) => all.indexOf(s) === i && (s === 'VET' || known.includes(s)))
        },
        spec(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.symbol)
        },
        fiat(): number {
            return parseFloat(this.typed || '0') || 0
        },
        priceText(): string {
            const digits = this.typed.includes('.') ? Math.min(2, this.typed.split('.')[1]!.length) : 0
            return new Intl.NumberFormat(numberLocale(), { style: 'currency', currency: prefs.currency, minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(this.fiat) +
                (this.typed.endsWith('.') ? this.decimal : '')
        },
        tokenPrice(): number {
            return this.prices[(this.spec?.address || ZERO).toLowerCase()] || 0
        },
        noPrice(): boolean {
            return this.fiat > 0 && !this.tokenPrice
        },
        preview(): string | null {
            return tillAmount(this.fiat, this.tokenPrice, this.fx, 1)
        },
        link(): string {
            const r = this.request
            return r ? buildPaymentLink({ to: r.to, amount: r.amount, symbol: r.symbol }) : ''
        }
    },
    watch: {
        symbol() { void this.loadPrice() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id))
        this.address = w?.meta.addresses[0] || this.addresses[0]?.value || ''
        this.tokens = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id)
        this.fx = await this.$svc.prices.fx(prefs.currency).catch(() => 1)
        await this.loadPrice()
    },
    beforeUnmount() {
        this.poll && clearInterval(this.poll)
    },
    methods: {
        press(k: string) {
            haptic('tap')
            this.typed = keypad(this.typed, k)
        },
        async loadPrice() {
            const a = (this.spec?.address || ZERO).toLowerCase()
            const stats = await this.$svc.prices.stats([this.spec?.address || null]).catch(() => ({} as Record<string, { price: number }>))
            if (stats[a]?.price) this.prices = { ...this.prices, [a]: stats[a]!.price }
        },
        fiatText(r: TillRequest): string {
            return new Intl.NumberFormat(numberLocale(), { style: 'currency', currency: r.currency }).format(r.fiat)
        },
        charge() {
            // a tag no open request has, so each one is recognised by its exact amount
            const open = new Set(payments.requests.filter(r => !r.paid).map(r => r.amount))
            let amount: string | null = null
            for (let tag = 1 + Math.floor(Math.random() * 99), n = 0; n < 99; n++, tag = tag % 99 + 1) {
                amount = tillAmount(this.fiat, this.tokenPrice, this.fx, tag)
                if (amount && !open.has(amount)) break
            }
            if (!amount) return
            const r: TillRequest = {
                id: newId(),
                gid: genesises.main.id,
                to: this.address,
                amount,
                symbol: this.symbol,
                token: this.spec?.address || '',
                decimals: this.spec?.decimals ?? 18,
                note: this.$t('pos.note', { price: this.priceText }),
                createdAt: Date.now(),
                fiat: this.fiat,
                currency: prefs.currency
            }
            // kept with the other requests: it shows under Payments, paid or not
            payments.requests = [r, ...payments.requests]
            this.request = payments.requests[0] as TillRequest
            this.poll = setInterval(() => void this.check(), 5000)
        },
        async check() {
            const r = this.request
            if (!r || r.paid) return
            try {
                const incoming = (await incomingTransfers(this.$svc.bc(r.gid).thor, [r.to], 30)).map(i => ({ ...i, gid: r.gid }))
                matchPaidRequests(incoming)
                const now = payments.requests.find(x => x.id === r.id)
                if (now?.paid) {
                    this.request = { ...r, paid: now.paid }
                    this.poll && clearInterval(this.poll)
                    haptic('success')
                    if (prefs.sound) playChime()
                }
            } catch { }
        },
        reset() {
            this.poll && clearInterval(this.poll)
            // a cancelled sale isn't a request anyone should still pay
            const r = this.request
            if (r && !r.paid) payments.requests = payments.requests.filter(x => x.id !== r.id)
            this.request = null
            this.typed = ''
        },
        bon(r: TillRequest) {
            if (!r.paid) return
            printReceipt({
                title: this.$t('pos.receipt_title'),
                lines: [
                    { label: this.$t('receipt.label_date'), value: new Date(r.paid.at).toLocaleString(this.$i18n.locale) },
                    { label: this.$t('receipt.label_amount'), value: `${r.amount} ${r.symbol}` },
                    { label: this.$t('receipt.label_value'), value: this.fiatText(r) },
                    { label: this.$t('txDetail.label_from'), value: r.paid.from },
                    { label: this.$t('txDetail.label_to'), value: r.to },
                    { label: this.$t('txDetail.label_id'), value: r.paid.txId }
                ],
                link: `${urls.explorerMain}transactions/${r.paid.txId}`,
                footer: this.$t('receipt.footer')
            }, this.$i18n.locale)
        }
    }
})
</script>
<style lang="sass" scoped>
.price
  font-size: 44px
  font-variant-numeric: tabular-nums

.preview
  min-height: 21px

.due
  font-size: 36px

.paid-title
  font-size: 28px

.qr
  width: 260px
  max-width: 80vw
  padding: 14px
  background: #fff
  border-radius: 14px

.hint
  max-width: 320px

.keypad
  display: grid
  grid-template-columns: repeat(3, 1fr)
  gap: 6px
  max-width: 360px
  margin: 0 auto

.key
  height: 58px
  font-size: 24px
  font-weight: 600
  background: rgba(255, 255, 255, 0.04)
  border-radius: 12px
</style>
