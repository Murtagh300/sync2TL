<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="editing ? $t('invoice.title_new') : $t('invoice.title')" />
        <page-content
            class="col"
            padding
        >
            <!-- the list -->
            <template v-if="!editing">
                <p class="text-soft">{{$t('invoice.msg_intro')}}</p>
                <empty-state
                    v-if="!list.length"
                    icon="o_receipt"
                    :text="$t('invoice.msg_none')"
                />
                <q-list
                    v-else
                    class="bvm-list"
                >
                    <q-item
                        v-for="inv in list"
                        :key="inv.id"
                        clickable
                        @click="print(inv)"
                    >
                        <q-item-section>
                            <q-item-label class="text-weight-bold">{{inv.number}} · {{inv.buyer.name}}</q-item-label>
                            <q-item-label caption>{{money(totals(inv).total, inv.currency)}} · {{inv.amount}} {{inv.symbol}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-badge
                                :color="status(inv) === 'paid' ? 'primary' : status(inv) === 'overdue' ? 'negative' : 'grey-8'"
                                :text-color="status(inv) === 'paid' ? 'dark' : 'white'"
                                rounded
                            >{{$t(`invoice.state_${status(inv)}`)}}</q-badge>
                            <q-btn
                                flat
                                round
                                dense
                                icon="o_link"
                                class="q-mt-xs"
                                :aria-label="$t('invoice.action_copy_link')"
                                @click.stop="copyLink(inv)"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
            </template>

            <!-- a new one -->
            <template v-else>
                <q-expansion-item
                    dense
                    dense-toggle
                    :default-opened="!seller.name"
                    icon="o_storefront"
                    :label="seller.name || $t('invoice.label_you')"
                    :caption="seller.name ? $t('invoice.label_you') : undefined"
                    class="bvm-tile q-mb-md"
                >
                    <div class="q-pa-md column q-gutter-y-sm">
                        <q-input
                            v-model="seller.name"
                            outlined
                            dense
                            :label="$t('invoice.label_name')"
                        />
                        <q-input
                            v-model="seller.details"
                            outlined
                            dense
                            autogrow
                            type="textarea"
                            :label="$t('invoice.label_details')"
                        />
                        <q-input
                            v-model="seller.vat"
                            outlined
                            dense
                            :label="$t('invoice.label_vat_number')"
                        />
                    </div>
                </q-expansion-item>

                <div class="text-weight-bold q-mb-xs">{{$t('invoice.label_customer')}}</div>
                <q-input
                    v-model="buyer.name"
                    outlined
                    dense
                    :label="$t('invoice.label_name')"
                    class="q-mb-sm"
                />
                <q-input
                    v-model="buyer.details"
                    outlined
                    dense
                    autogrow
                    type="textarea"
                    :label="$t('invoice.label_details')"
                    class="q-mb-md"
                />

                <div class="text-weight-bold q-mb-xs">{{$t('invoice.label_lines')}}</div>
                <div
                    v-for="(l, i) in lines"
                    :key="i"
                    class="row no-wrap q-gutter-x-sm items-start q-mb-sm"
                >
                    <q-input
                        v-model="l.text"
                        outlined
                        dense
                        class="col"
                        :label="$t('invoice.label_item')"
                    />
                    <q-input
                        v-model.number="l.qty"
                        outlined
                        dense
                        type="number"
                        min="0"
                        class="qty"
                        :label="$t('invoice.label_qty')"
                    />
                    <q-input
                        v-model.number="l.price"
                        outlined
                        dense
                        type="number"
                        min="0"
                        step="0.01"
                        class="price"
                        :label="$t('invoice.label_price', { currency })"
                    />
                    <q-btn
                        flat
                        round
                        dense
                        icon="o_close"
                        class="q-mt-xs"
                        :disable="lines.length < 2"
                        :aria-label="$t('common.delete')"
                        @click="lines.splice(i, 1)"
                    />
                </div>
                <q-btn
                    flat
                    no-caps
                    dense
                    color="primary"
                    icon="o_add"
                    :label="$t('invoice.action_add_line')"
                    @click="lines.push({ text: '', qty: 1, price: 0 })"
                />

                <div class="row q-gutter-x-sm q-mt-md">
                    <q-input
                        v-model.number="vatRate"
                        outlined
                        dense
                        type="number"
                        min="0"
                        max="100"
                        class="col"
                        :label="$t('invoice.label_vat')"
                        suffix="%"
                    />
                    <q-input
                        v-model.number="dueDays"
                        outlined
                        dense
                        type="number"
                        min="0"
                        class="col"
                        :label="$t('invoice.label_due_days')"
                    />
                </div>

                <div class="row q-gutter-sm q-my-md">
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
                <q-select
                    v-if="addresses.length > 1"
                    v-model="to"
                    :options="addresses"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('invoice.label_paid_to')"
                    class="q-mb-sm"
                />
                <q-input
                    v-model="note"
                    outlined
                    dense
                    autogrow
                    :label="$t('invoice.label_note')"
                />

                <div class="bvm-tile q-pa-md q-mt-md">
                    <div class="row justify-between text-muted"><span>{{$t('invoice.label_net')}}</span><span>{{money(draftTotals.net, currency)}}</span></div>
                    <div class="row justify-between text-muted"><span>{{$t('invoice.label_vat')}} {{vatRate || 0}}%</span><span>{{money(draftTotals.vat, currency)}}</span></div>
                    <div class="row justify-between text-weight-bold q-mt-xs"><span>{{$t('invoice.label_total')}}</span><span>{{money(draftTotals.total, currency)}}</span></div>
                    <div class="text-right text-soft">{{preview ? `≈ ${preview} ${symbol}` : (draftTotals.total > 0 ? $t('pos.msg_no_price', { symbol }) : '')}}</div>
                </div>
            </template>
        </page-content>
        <page-action>
            <q-btn
                v-if="!editing"
                unelevated
                no-caps
                color="primary"
                icon="o_add"
                :disable="!addresses.length"
                :label="$t('invoice.action_new')"
                @click="startNew()"
            />
            <template v-else>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    :disable="!canMake"
                    :label="$t('invoice.action_make')"
                    @click="make()"
                />
                <q-btn
                    flat
                    no-caps
                    class="q-mt-sm"
                    :label="$t('common.cancel')"
                    @click="editing = false"
                />
            </template>
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import EmptyState from 'components/EmptyState.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { numberLocale } from 'src/utils/format'
import { prefs } from 'src/utils/prefs'
import { copyText } from 'src/utils/clipboard'
import { incomingTransfers } from 'src/utils/incoming'
import { buildPaymentLink } from 'src/utils/payment-request'
import { matchPaidRequests, newId, payments, type PaymentRequestRecord } from 'src/utils/payments'
import { tillAmount } from 'src/utils/pos'
import type { Currency } from 'src/utils/fiat'
import { dueDate, invoiceHtml, invoices, invoiceTotals, nextInvoiceNumber, printPage, type Invoice, type InvoiceLine } from 'src/utils/invoice'

const ZERO = '0x0000000000000000000000000000000000000000'

// invoices with lines and VAT, paid in crypto and recognised when paid
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, EmptyState },
    data: () => ({
        wallets: [] as M.Wallet[],
        tokens: [] as M.TokenSpec[],
        editing: false,
        seller: invoices.seller,
        buyer: { name: '', details: '' },
        lines: [{ text: '', qty: 1, price: 0 }] as InvoiceLine[],
        vatRate: 21,
        dueDays: 14,
        symbol: 'VET',
        to: '',
        note: '',
        prices: {} as Record<string, number>,
        fx: 1
    }),
    computed: {
        currency(): Currency {
            return prefs.currency
        },
        list(): Invoice[] {
            return [...invoices.list].sort((a, b) => b.createdAt - a.createdAt)
        },
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id)
                .flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        symbols(): string[] {
            const known = this.tokens.map(t => t.symbol)
            return ['VET', 'B3TR', ...known.filter(s => /USD|EUR/i.test(s))].filter((s, i, all) => all.indexOf(s) === i && (s === 'VET' || known.includes(s)))
        },
        spec(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.symbol)
        },
        tokenPrice(): number {
            return this.prices[(this.spec?.address || ZERO).toLowerCase()] || 0
        },
        draftTotals(): { net: number, vat: number, total: number } {
            return invoiceTotals(this.lines, this.vatRate)
        },
        preview(): string | null {
            return tillAmount(this.draftTotals.total, this.tokenPrice, this.fx, 1)
        },
        canMake(): boolean {
            return !!this.seller.name.trim() && !!this.buyer.name.trim() && !!this.to && !!this.preview && this.lines.every(l => l.text.trim() && l.qty > 0)
        }
    },
    watch: {
        symbol() { void this.loadPrice() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id))
        this.to = w?.meta.addresses[0] || this.addresses[0]?.value || ''
        this.tokens = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id)
        this.fx = await this.$svc.prices.fx(prefs.currency).catch(() => 1)
        void this.checkPaid()
    },
    methods: {
        money(n: number, currency: string) {
            return new Intl.NumberFormat(numberLocale(), { style: 'currency', currency }).format(n)
        },
        totals(inv: Invoice) {
            return invoiceTotals(inv.lines, inv.vatRate)
        },
        request(inv: Invoice): PaymentRequestRecord | undefined {
            return payments.requests.find(r => r.id === inv.requestId)
        },
        status(inv: Invoice): 'paid' | 'open' | 'overdue' {
            if (this.request(inv)?.paid) return 'paid'
            return Date.now() > dueDate(inv) ? 'overdue' : 'open'
        },
        link(inv: Invoice) {
            return buildPaymentLink({ to: inv.to, amount: inv.amount, symbol: inv.symbol })
        },
        async loadPrice() {
            const a = (this.spec?.address || ZERO).toLowerCase()
            const stats = await this.$svc.prices.stats([this.spec?.address || null]).catch(() => ({} as Record<string, { price: number }>))
            if (stats[a]?.price) this.prices = { ...this.prices, [a]: stats[a]!.price }
        },
        startNew() {
            this.buyer = { name: '', details: '' }
            this.lines = [{ text: '', qty: 1, price: 0 }]
            this.note = ''
            this.editing = true
            void this.loadPrice()
        },
        make() {
            const total = this.draftTotals.total
            // its own last digits, as the till does, so the payment is told apart
            const open = new Set(payments.requests.filter(r => !r.paid).map(r => r.amount))
            let amount: string | null = null
            for (let tag = 1 + Math.floor(Math.random() * 99), n = 0; n < 99; n++, tag = tag % 99 + 1) {
                amount = tillAmount(total, this.tokenPrice, this.fx, tag)
                if (amount && !open.has(amount)) break
            }
            if (!amount) return
            const number = nextInvoiceNumber(invoices.list)
            const r: PaymentRequestRecord = {
                id: newId(),
                gid: genesises.main.id,
                to: this.to,
                amount,
                symbol: this.symbol,
                token: this.spec?.address || '',
                decimals: this.spec?.decimals ?? 18,
                note: this.$t('invoice.request_note', { number }),
                createdAt: Date.now()
            }
            payments.requests = [r, ...payments.requests]
            const inv: Invoice = {
                id: newId(),
                number,
                createdAt: Date.now(),
                dueDays: Math.max(0, Math.round(this.dueDays || 0)),
                seller: { ...this.seller },
                buyer: { ...this.buyer },
                lines: this.lines.map(l => ({ text: l.text.trim(), qty: Number(l.qty), price: Number(l.price) })),
                vatRate: Number(this.vatRate) || 0,
                currency: this.currency,
                symbol: this.symbol,
                amount,
                rate: this.tokenPrice * this.fx,
                to: this.to,
                note: this.note.trim(),
                requestId: r.id
            }
            invoices.list = [inv, ...invoices.list]
            this.editing = false
            this.print(inv)
        },
        print(inv: Invoice) {
            const t = (k: string, p?: Record<string, unknown>) => this.$t(`invoice.${k}`, p || {})
            const rate = new Intl.NumberFormat(numberLocale(), { style: 'currency', currency: inv.currency, maximumFractionDigits: 4 }).format(inv.rate)
            printPage(invoiceHtml(inv, {
                title: t('pdf_title'),
                number: t('pdf_number'),
                date: t('pdf_date'),
                due: t('pdf_due'),
                from: t('pdf_from'),
                to: t('pdf_to'),
                vatNumber: t('label_vat_number'),
                item: t('label_item'),
                qty: t('label_qty'),
                price: t('pdf_price'),
                total: t('label_total'),
                net: t('label_net'),
                vat: t('label_vat'),
                pay: t('pdf_pay'),
                rate: t('pdf_rate', { symbol: inv.symbol, rate }),
                paid: t('state_paid')
            }, this.link(inv), { lang: this.$i18n.locale, paid: this.status(inv) === 'paid' }))
        },
        async copyLink(inv: Invoice) {
            await copyText(this.link(inv))
            this.$q.notify(this.$t('common.copied'))
        },
        async checkPaid() {
            const open = invoices.list.map(i => this.request(i)).filter((r): r is PaymentRequestRecord => !!r && !r.paid)
            const addresses = [...new Set(open.map(r => r.to))]
            if (!addresses.length) return
            try {
                const incoming = (await incomingTransfers(this.$svc.bc(genesises.main.id).thor, addresses, 50)).map(i => ({ ...i, gid: genesises.main.id }))
                matchPaidRequests(incoming)
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.qty
  width: 70px

.price
  width: 110px
</style>
