<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('pos.title')">
            <q-btn
                v-if="tapOn && address"
                flat
                round
                icon="o_nfc"
                :aria-label="$t('tap.action_sticker')"
                @click="openSticker()"
            />
            <q-btn
                flat
                round
                icon="o_summarize"
                :aria-label="$t('pos.action_days')"
                @click="showDays = true"
            />
        </page-toolbar>
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
                        <bv-loader
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
        <!-- the day overview: what the till took, per day -->
        <q-dialog
            v-model="showDays"
            :position="$q.screen.xs ? 'bottom' : 'standard'"
        >
            <q-card class="full-width days-card">
                <q-card-section class="row items-center no-wrap">
                    <div class="bvm-display col days-title">{{$t('pos.action_days')}}</div>
                    <q-btn
                        flat
                        no-caps
                        icon="o_download"
                        :disable="!days.length"
                        :label="$t('pos.action_csv')"
                        @click="exportCsv()"
                    />
                </q-card-section>
                <q-card-section class="q-pt-none">
                    <div
                        v-if="!days.length"
                        class="text-muted text-center q-py-lg"
                    >{{$t('pos.msg_no_sales')}}</div>
                    <q-list
                        v-else
                        class="bvm-list"
                    >
                        <q-item
                            v-for="d in days"
                            :key="d.day"
                        >
                            <q-item-section>
                                <q-item-label class="text-weight-bold">{{dayText(d.day)}}</q-item-label>
                                <q-item-label caption>{{$t('pos.label_sales', { n: d.count })}}, {{tokenText(d.tokens)}}</q-item-label>
                            </q-item-section>
                            <q-item-section
                                side
                                class="text-weight-bold"
                            >{{fiatTotals(d.fiat)}}</q-item-section>
                        </q-item>
                    </q-list>
                    <p class="text-caption text-muted q-mt-md">{{$t('pos.msg_cashier')}}</p>
                </q-card-section>
            </q-card>
        </q-dialog>
        <!-- an NFC sticker or printed code at the counter that always opens the open sale -->
        <q-dialog
            v-model="showSticker"
            :position="$q.screen.xs ? 'bottom' : 'standard'"
        >
            <q-card class="full-width days-card">
                <q-card-section>
                    <div class="bvm-display days-title">{{$t('tap.action_sticker')}}</div>
                    <p class="text-soft q-mt-sm">{{$t('tap.msg_sticker')}}</p>
                    <div
                        v-if="tapUrl"
                        class="column items-center"
                    >
                        <div class="qr bvm-tile">
                            <q-r-code :key="tapUrl">{{tapUrl}}</q-r-code>
                        </div>
                        <div class="text-caption text-muted q-mt-sm ellipsis full-width text-center">{{tapUrl}}</div>
                    </div>
                    <q-skeleton
                        v-else
                        height="200px"
                    />
                </q-card-section>
                <q-card-actions class="column q-gutter-y-sm q-px-md q-pb-md">
                    <q-btn
                        v-if="nfcWritable"
                        unelevated
                        no-caps
                        color="primary"
                        icon="o_nfc"
                        class="full-width"
                        :loading="writing"
                        :disable="!tapUrl"
                        :label="$t('tap.action_write')"
                        @click="writeSticker()"
                    />
                    <q-btn
                        outline
                        no-caps
                        color="primary"
                        icon="o_content_copy"
                        class="full-width"
                        :disable="!tapUrl"
                        :label="$t('tap.action_copy')"
                        @click="copyTap()"
                    />
                </q-card-actions>
            </q-card>
        </q-dialog>
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
import { keypad, tillAmount, tillCsv, tillDays, type TillDay } from 'src/utils/pos'
import { canWriteNfc, ensureTill, showSale, tapAvailable, tapLink, writeNfc } from 'src/utils/till-tap'
import { downloadText } from 'src/utils/export'
import { copyText } from 'src/utils/clipboard'
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
        decimal: decimalSeparator(),
        showDays: false,
        showSticker: false,
        tapOn: tapAvailable(),
        tapUrl: '',
        writing: false,
        nfcWritable: canWriteNfc()
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
        /** the till's sales so far, per day */
        days(): TillDay[] {
            return tillDays(payments.requests as TillRequest[])
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
            // a tap on the counter's sticker opens this sale
            void showSale(r.to, { amount: r.amount, symbol: r.symbol })
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
                    void showSale(r.to, null)
                    haptic('success')
                    if (prefs.sound) playChime()
                }
            } catch { }
        },
        reset() {
            this.poll && clearInterval(this.poll)
            // a cancelled sale isn't a request anyone should still pay
            const r = this.request
            if (r && !r.paid) {
                payments.requests = payments.requests.filter(x => x.id !== r.id)
                void showSale(r.to, null)
            }
            this.request = null
            this.typed = ''
        },
        dayText(day: string) {
            return new Date(`${day}T12:00:00`).toLocaleDateString(this.$i18n.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        },
        fiatTotals(fiat: Record<string, number>) {
            return Object.entries(fiat).map(([c, v]) => new Intl.NumberFormat(numberLocale(), { style: 'currency', currency: c }).format(v)).join(' + ')
        },
        tokenText(tokens: Record<string, string>) {
            return Object.entries(tokens).map(([s, v]) => `${new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 2 }).format(Number(v))} ${s}`).join(', ')
        },
        exportCsv() {
            const headers = [this.$t('receipt.label_date'), this.$t('receipt.label_value'), this.$t('pos.label_currency'), this.$t('receipt.label_amount'), this.$t('pos.label_token'), this.$t('txDetail.label_from'), this.$t('txDetail.label_id')]
            downloadText(`blackvault-till-${new Date().toISOString().slice(0, 10)}.csv`, tillCsv(payments.requests as TillRequest[], headers))
        },
        async openSticker() {
            this.showSticker = true
            this.tapUrl = ''
            try {
                this.tapUrl = tapLink((await ensureTill(this.address)).id)
            } catch (err) {
                console.warn('till:', err)
                this.showSticker = false
                this.$q.notify(this.$t('common.something_wrong'))
            }
        },
        async writeSticker() {
            this.writing = true
            try {
                this.$q.notify(this.$t('tap.msg_hold'))
                await writeNfc(this.tapUrl)
                this.$q.notify(this.$t('tap.msg_written'))
            } catch (err) {
                console.warn('nfc:', err)
                this.$q.notify(this.$t('tap.msg_write_failed'))
            } finally {
                this.writing = false
            }
        },
        async copyTap() {
            await copyText(this.tapUrl)
            this.$q.notify(this.$t('common.copied'))
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

.days-card
  max-width: 480px

.days-title
  font-size: 22px

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
