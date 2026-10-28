<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('payments.title')" />
        <page-content
            class="col"
            padding
        >
            <q-tabs
                v-model="tab"
                dense
                no-caps
                align="left"
                active-color="primary"
                indicator-color="primary"
                class="q-mb-md pay-tabs"
            >
                <q-tab
                    name="requests"
                    :label="$t('payments.tab_requests')"
                />
                <q-tab
                    name="scheduled"
                    :label="$t('payments.tab_scheduled')"
                />
                <q-tab
                    name="buys"
                    :label="$t('buys.tab')"
                />
            </q-tabs>

            <!-- requests you sent -->
            <template v-if="tab === 'requests'">
                <p class="text-soft">{{$t('payments.msg_requests')}}</p>
                <q-list
                    role="group"
                    v-if="payments.requests.length"
                    class="bvm-list q-mb-md"
                >
                    <q-item
                        v-for="r in sortedRequests"
                        :key="r.id"
                        clickable
                        @click="showRequest(r)"
                    >
                        <q-item-section avatar>
                            <q-avatar
                                :icon="r.paid ? 'check_circle' : 'o_schedule'"
                                :class="r.paid ? 'text-primary' : 'text-warning'"
                            />
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label class="bvm-amount">{{r.amount}} {{r.symbol}}</q-item-label>
                            <q-item-label
                                caption
                                lines="1"
                            >{{r.note || ago(r.createdAt)}}</q-item-label>
                            <q-item-label
                                v-if="r.paid"
                                caption
                                lines="1"
                            >{{$t('payments.label_paid_by')}} <address-label :addr="r.paid.from" /> · {{ago(r.paid.at)}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-btn
                                :aria-label="$t('common.delete')"
                                flat
                                round
                                dense
                                icon="o_delete"
                                @click.stop="removeRequest(r)"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <div class="row no-wrap q-gutter-x-sm">
                    <q-btn
                        class="col"
                        unelevated
                        no-caps
                        color="primary"
                        icon="add"
                        :label="$t('payments.title_new_request')"
                        @click="newRequest()"
                    />
                    <q-btn
                        class="col"
                        outline
                        no-caps
                        color="primary"
                        icon="o_call_split"
                        :label="$t('split.title')"
                        @click="splitBill()"
                    />
                </div>
            </template>

            <!-- buys on a schedule, or at a price: a reminder and the swap filled in -->
            <template v-else-if="tab === 'buys'">
                <p class="text-soft">{{$t('buys.msg_intro')}}</p>
                <q-list
                    v-if="payments.buys.length"
                    role="group"
                    class="bvm-list q-mb-md"
                >
                    <q-item
                        v-for="b in payments.buys"
                        :key="b.id"
                    >
                        <q-item-section avatar>
                            <q-avatar :icon="b.every ? 'o_event_repeat' : 'o_trending_down'" />
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label class="bvm-amount">{{b.amount}} {{b.from}} → {{b.to}}</q-item-label>
                            <q-item-label caption>{{buyWhen(b)}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <div class="column items-end q-gutter-y-xs">
                                <q-btn
                                    :unelevated="isDue(b)"
                                    :outline="!isDue(b)"
                                    dense
                                    no-caps
                                    color="primary"
                                    class="q-px-sm"
                                    :label="$t('buys.action_buy_now')"
                                    @click="buyNow(b)"
                                />
                                <q-btn
                                    flat
                                    dense
                                    no-caps
                                    size="sm"
                                    color="negative"
                                    :label="$t('common.delete')"
                                    @click="removeBuy(b)"
                                />
                            </div>
                        </q-item-section>
                    </q-item>
                </q-list>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    icon="add"
                    class="full-width"
                    :label="$t('buys.title_new')"
                    @click="newBuy()"
                />
            </template>

            <!-- payments you make regularly -->
            <template v-else>
                <p class="text-soft">{{$t('payments.msg_scheduled')}}</p>
                <q-list
                    role="group"
                    v-if="payments.scheduled.length"
                    class="bvm-list q-mb-md"
                >
                    <q-item
                        v-for="s in payments.scheduled"
                        :key="s.id"
                    >
                        <q-item-section avatar>
                            <q-avatar icon="o_event_repeat" />
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label class="bvm-amount">{{s.amount}} {{s.symbol}} → <address-label :addr="s.to" /></q-item-label>
                            <q-item-label caption>{{$t(s.every === 'week' ? 'payments.every_week' : 'payments.every_month')}} · {{$t('payments.label_next', { when: day(s.next) })}}</q-item-label>
                            <q-item-label
                                v-if="s.note"
                                caption
                            >“{{s.note}}”</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <div class="column items-end q-gutter-y-xs">
                                <q-btn
                                    :unelevated="s.next <= now"
                                    :outline="s.next > now"
                                    dense
                                    no-caps
                                    color="primary"
                                    class="q-px-sm"
                                    :label="$t('payments.action_pay_now')"
                                    @click="payNow(s)"
                                />
                                <q-btn
                                    flat
                                    dense
                                    no-caps
                                    size="sm"
                                    color="negative"
                                    :label="$t('common.delete')"
                                    @click="removeScheduled(s)"
                                />
                            </div>
                        </q-item-section>
                    </q-item>
                </q-list>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    icon="add"
                    class="full-width"
                    :label="$t('payments.title_new_scheduled')"
                    @click="newScheduled()"
                />
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import PaymentDialog, { type PaymentDialogResult } from './PaymentDialog.vue'
import SplitDialog, { type SplitResult } from './SplitDialog.vue'
import BuyDialog, { type BuyDialogResult } from './BuyDialog.vue'
import { money, prefs } from 'src/utils/prefs'
import { syncBuyReminders } from 'src/utils/buy-reminders'
import { buyRoute, matchPaidRequests, newId, payments, type PaymentRequestRecord, type ScheduledBuy, type ScheduledPayment } from 'src/utils/payments'
import { incomingTransfers } from 'src/utils/incoming'
import { buildPaymentLink } from 'src/utils/payment-request'
import { selectedWallet } from 'src/utils/selection'
import { visibleTokens } from 'src/utils/tokens'
import { formatDate } from 'src/utils/format'

// payment requests (with whether they were paid) and payments on a schedule
export default defineComponent({
    components: { PageToolbar, PageContent, AddressLabel },
    data: () => ({
        tab: 'requests' as 'requests' | 'scheduled' | 'buys',
        /** one token in the chosen currency, by symbol */
        prices: {} as Record<string, number>,
        payments,
        wallets: [] as M.Wallet[],
        tokens: [] as M.TokenSpec[],
        now: Date.now()
    }),
    computed: {
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets)
        },
        sortedRequests(): PaymentRequestRecord[] {
            return [...payments.requests].sort((a, b) => Number(!!a.paid) - Number(!!b.paid) || b.createdAt - a.createdAt)
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = this.wallet
        if (w) {
            this.tokens = await visibleTokens(this.$svc, w.gid, w.meta.addresses[0]!)
        }
        void this.checkPaid()
    },
    methods: {
        ago(t: number) {
            return formatDate(t, { relative: true })
        },
        day(t: number) {
            return new Date(t).toLocaleDateString(this.$i18n.locale, { day: 'numeric', month: 'short' })
        },
        /** which open requests were paid since */
        async checkPaid() {
            const open = payments.requests.filter(r => !r.paid)
            const byGid = new Map<string, string[]>()
            for (const r of open) byGid.set(r.gid, [...new Set([...(byGid.get(r.gid) || []), r.to])])
            for (const [gid, addresses] of byGid) {
                try {
                    const incoming = (await incomingTransfers(this.$svc.bc(gid).thor, addresses, 50)).map(i => ({ ...i, gid }))
                    const paid = matchPaidRequests(incoming)
                    paid.forEach(r => this.$q.notify(this.$t('payments.msg_paid', { amount: `${r.amount} ${r.symbol}` })))
                } catch { }
            }
        },
        async newRequest() {
            const w = this.wallet
            if (!w) return
            try {
                const r = await this.$dialog<PaymentDialogResult>({ component: PaymentDialog, symbols: this.tokens.map(t => t.symbol) })
                const spec = this.tokens.find(t => t.symbol === r.symbol)
                const record: PaymentRequestRecord = {
                    id: newId(),
                    gid: w.gid,
                    to: w.meta.addresses[0]!,
                    amount: r.amount,
                    symbol: r.symbol,
                    token: spec?.address || '',
                    decimals: spec?.decimals ?? 18,
                    note: r.note,
                    createdAt: Date.now()
                }
                payments.requests = [record, ...payments.requests]
                this.showRequest(record)
            } catch { }
        },
        /** one request per person; shown one after the other to share */
        async splitBill() {
            const w = this.wallet
            if (!w) return
            let r: SplitResult
            try {
                r = await this.$dialog<SplitResult>({ component: SplitDialog, symbols: this.tokens.map(t => t.symbol) })
            } catch {
                return
            }
            const spec = this.tokens.find(t => t.symbol === r.symbol)
            const now = Date.now()
            const records: PaymentRequestRecord[] = r.shares.map((s, k) => ({
                id: newId(),
                gid: w.gid,
                to: w.meta.addresses[0]!,
                amount: s.amount,
                symbol: r.symbol,
                token: spec?.address || '',
                decimals: spec?.decimals ?? 18,
                note: [r.note, s.name].filter(Boolean).join(' · '),
                // in order, so they settle in order
                createdAt: now + k
            }))
            payments.requests = [...records, ...payments.requests]
            this.$q.notify(this.$t('split.msg_created', { n: records.length }))
        },
        showRequest(r: PaymentRequestRecord) {
            const link = buildPaymentLink({ to: r.to, amount: r.amount, symbol: r.symbol })
            this.$qrcode({
                title: `${r.amount} ${r.symbol}${r.note ? ` · ${r.note}` : ''}`,
                content: link,
                message: r.paid ? this.$t('payments.label_paid') : this.$t('payments.msg_share_request'),
                messageClass: 'text-center text-muted'
            })
        },
        removeRequest(r: PaymentRequestRecord) {
            payments.requests = payments.requests.filter(x => x.id !== r.id)
        },
        async newScheduled() {
            const w = this.wallet
            if (!w) return
            try {
                const r = await this.$dialog<PaymentDialogResult>({ component: PaymentDialog, scheduled: true, symbols: this.tokens.map(t => t.symbol) })
                const s: ScheduledPayment = {
                    id: newId(),
                    walletId: w.id,
                    addressIndex: 0,
                    to: r.to,
                    amount: r.amount,
                    symbol: r.symbol,
                    note: r.note,
                    every: r.every,
                    next: Date.now()
                }
                payments.scheduled = [...payments.scheduled, s]
            } catch { }
        },
        payNow(s: ScheduledPayment) {
            void this.$router.push({
                name: 'send',
                query: { wid: String(s.walletId), i: String(s.addressIndex), to: s.to, amount: s.amount, symbol: s.symbol, schedule: s.id }
            })
        },
        removeScheduled(s: ScheduledPayment) {
            payments.scheduled = payments.scheduled.filter(x => x.id !== s.id)
        },
        isDue(b: ScheduledBuy) {
            return b.every ? b.next <= this.now : !!b.fired
        },
        buyWhen(b: ScheduledBuy): string {
            if (b.every) {
                const every = b.every === 'day' ? this.$t('buys.every_day') : this.$t(b.every === 'week' ? 'payments.every_week' : 'payments.every_month')
                return `${every} · ${this.$t('payments.label_next', { when: this.day(b.next) })}`
            }
            return this.$t('buys.label_at', { symbol: b.to, price: money(b.below || 0) })
        },
        async loadPrices() {
            try {
                const [stats, fx] = await Promise.all([
                    this.$svc.prices.stats(this.tokens.map(t => t.address || '0x0000000000000000000000000000000000000000')),
                    this.$svc.prices.fx(prefs.currency)
                ])
                const out: Record<string, number> = {}
                for (const t of this.tokens) {
                    const st = stats[(t.address || '0x0000000000000000000000000000000000000000').toLowerCase()]
                    if (st) out[t.symbol] = st.price * fx
                }
                this.prices = out
            } catch { }
        },
        async newBuy() {
            const w = this.wallet
            if (!w) return
            void this.loadPrices()
            try {
                const r = await this.$dialog<BuyDialogResult>({
                    component: BuyDialog,
                    symbols: this.tokens.map(t => t.symbol),
                    currency: prefs.currency,
                    priceOf: (symbol: string) => this.prices[symbol] ? money(this.prices[symbol]) : ''
                })
                const b: ScheduledBuy = {
                    id: newId(),
                    walletId: w.id,
                    addressIndex: 0,
                    from: r.from,
                    to: r.to,
                    amount: r.amount,
                    every: r.every,
                    below: r.below,
                    currency: prefs.currency,
                    next: Date.now()
                }
                payments.buys = [...payments.buys, b]
                void syncBuyReminders(this.$t.bind(this))
            } catch { }
        },
        buyNow(b: ScheduledBuy) {
            void this.$router.push(buyRoute(b))
        },
        removeBuy(b: ScheduledBuy) {
            payments.buys = payments.buys.filter(x => x.id !== b.id)
            void syncBuyReminders(this.$t.bind(this))
        }
    }
})
</script>
<style lang="sass" scoped>
.pay-tabs
  :deep(.q-tab__label)
    font-size: 15px
    font-weight: 800
</style>
