<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('subs.title')" />
        <page-content
            class="col"
            padding
        >
            <q-btn-toggle
                v-model="tab"
                :options="[{ label: $t('subs.tab_paying'), value: 'paying' }, { label: $t('subs.tab_selling'), value: 'selling' }]"
                spread
                no-caps
                unelevated
                toggle-color="primary"
                color="dark"
                class="q-mb-md"
            />

            <!-- what this wallet pays -->
            <template v-if="tab === 'paying'">
                <empty-state
                    v-if="!active.length"
                    icon="o_autorenew"
                    :text="$t('subs.msg_none_paying')"
                />
                <q-list
                    v-else
                    role="list"
                    class="bvm-list"
                >
                    <q-item
                        v-for="s in active"
                        :key="s.id"
                    >
                        <q-item-section>
                            <q-item-label class="text-weight-bold">{{s.name || $t('subs.label_unnamed')}}</q-item-label>
                            <q-item-label caption>{{s.amount}} {{s.symbol}} {{$t(`subs.per_${s.every}`)}} · <address-label :addr="s.to" /></q-item-label>
                            <q-item-label
                                v-if="left[s.id] !== undefined"
                                caption
                            >{{$t('subs.label_left', { n: left[s.id] })}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-btn
                                flat
                                dense
                                no-caps
                                color="negative"
                                :label="$t('subs.action_cancel')"
                                @click="cancel(s)"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
            </template>

            <!-- what this wallet sells -->
            <template v-else>
                <div class="bvm-tile q-pa-md q-mb-md">
                    <div class="text-weight-bold q-mb-sm">{{$t('subs.title_new_plan')}}</div>
                    <q-input
                        v-model="form.name"
                        outlined
                        dense
                        maxlength="60"
                        :label="$t('subs.label_plan_name')"
                        class="q-mb-sm"
                    />
                    <div class="row q-col-gutter-sm q-mb-sm">
                        <div class="col-6">
                            <q-input
                                v-model="form.amount"
                                outlined
                                dense
                                inputmode="decimal"
                                :label="$t('subs.label_amount')"
                            />
                        </div>
                        <div class="col-6">
                            <q-select
                                v-model="form.symbol"
                                :options="symbols"
                                outlined
                                dense
                                :label="$t('subs.label_token')"
                            />
                        </div>
                    </div>
                    <q-btn-toggle
                        v-model="form.every"
                        :options="[{ label: $t('subs.every_week'), value: 'week' }, { label: $t('subs.every_month'), value: 'month' }]"
                        spread
                        no-caps
                        unelevated
                        dense
                        toggle-color="primary"
                        color="dark"
                        class="q-mb-sm"
                    />
                    <q-select
                        v-if="addresses.length > 1"
                        v-model="form.to"
                        :options="addresses"
                        emit-value
                        map-options
                        outlined
                        dense
                        :label="$t('subs.label_paid_to')"
                        class="q-mb-sm"
                    />
                    <div
                        v-if="formError"
                        class="text-negative text-caption q-mb-sm"
                    >{{formError}}</div>
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        class="full-width"
                        :disable="!formOk"
                        :label="$t('subs.action_create')"
                        @click="createPlan()"
                    />
                </div>

                <div
                    v-for="p in subs.plans"
                    :key="p.id"
                    class="bvm-tile q-pa-md q-mb-md"
                >
                    <div class="row items-start no-wrap">
                        <div class="col">
                            <div class="text-weight-bold">{{p.name || $t('subs.label_unnamed')}}</div>
                            <div class="text-caption text-muted">{{p.amount}} {{p.symbol}} {{$t(`subs.per_${p.every}`)}} · <address-label :addr="p.to" /></div>
                        </div>
                        <q-btn
                            flat
                            round
                            dense
                            icon="o_qr_code_2"
                            :aria-label="$t('subs.action_share')"
                            @click="share(p)"
                        />
                        <q-btn
                            flat
                            round
                            dense
                            icon="o_delete"
                            :aria-label="$t('common.delete')"
                            @click="removePlan(p)"
                        />
                    </div>
                    <div class="q-mt-sm">
                        <q-btn
                            v-if="!found[p.id]"
                            outline
                            dense
                            no-caps
                            color="primary"
                            class="q-px-sm"
                            :loading="loadingPlan === p.id"
                            :label="$t('subs.action_subscribers')"
                            @click="loadSubscribers(p)"
                        />
                        <template v-else>
                            <div
                                v-if="!found[p.id]!.length"
                                class="text-caption text-muted"
                            >{{$t('subs.msg_no_subscribers')}}</div>
                            <div
                                v-for="s in found[p.id]"
                                :key="s.address"
                                class="row items-center no-wrap sub-row"
                            >
                                <address-label
                                    :addr="s.address"
                                    class="col ellipsis"
                                />
                                <span
                                    class="text-caption"
                                    :class="s.collectable ? 'text-primary' : s.due ? 'text-warning' : 'text-muted'"
                                >{{subState(s)}}</span>
                            </div>
                            <q-btn
                                v-if="collectable(p).length"
                                unelevated
                                no-caps
                                color="primary"
                                class="full-width q-mt-sm"
                                :loading="working"
                                :label="$t('subs.action_collect', { n: collectable(p).length, amount: `${collectTotal(p)} ${p.symbol}` })"
                                @click="collect(p)"
                            />
                        </template>
                    </div>
                </div>
                <p class="text-caption text-muted">{{$t('subs.msg_seller_how', { n: PERIODS })}}</p>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import AddressLabel from 'components/AddressLabel.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { fns } from 'src/utils/actions'
import { formatDate, formatUnits } from 'src/utils/format'
import { newId } from 'src/utils/payments'
import { cancelClause, collectClauses, findSubscribers, PERIODS, planLink, planWei, subs, type Every, type Plan, type Subscriber, type Subscription } from 'src/utils/subscriptions'

// subscriptions: the ones this wallet pays (and cancelling), and plans it sells (sharing, collecting)
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressLabel },
    data: () => ({
        PERIODS,
        subs,
        tab: 'paying' as 'paying' | 'selling',
        wallets: [] as M.Wallet[],
        tokens: [] as M.TokenSpec[],
        form: { name: '', amount: '', symbol: 'B3TR', every: 'month' as Every, to: '' },
        /** periods each subscription still allows */
        left: {} as Record<string, number>,
        found: {} as Record<string, Subscriber[]>,
        loadingPlan: '',
        working: false
    }),
    computed: {
        thor(): Connex.Thor { return this.$svc.bc(genesises.main.id).thor },
        active(): Subscription[] {
            return subs.subscriptions.filter(s => !s.cancelled)
        },
        symbols(): string[] {
            return this.tokens.map(t => t.symbol)
        },
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id && canSign(w))
                .flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        formError(): string {
            const f = this.form
            if (f.amount && !(/^\d+(\.\d+)?$/.test(f.amount) && parseFloat(f.amount) > 0)) return this.$t('send.msg_invalid_amount')
            if (f.amount && subs.plans.some(p => p.symbol === f.symbol && p.to.toLowerCase() === f.to.toLowerCase())) return this.$t('subs.msg_one_per_token', { symbol: f.symbol })
            return ''
        },
        formOk(): boolean {
            return !!this.form.amount && !this.formError && !!this.form.to && this.symbols.includes(this.form.symbol)
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        this.tokens = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id && t.symbol !== 'VET')
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id && canSign(x)))
        this.form.to = w?.meta.addresses[0] || this.addresses[0]?.value || ''
        if (!this.active.length && subs.plans.length) this.tab = 'selling'
        void this.loadLeft()
    },
    methods: {
        async loadLeft() {
            for (const s of this.active) {
                try {
                    const [out] = await this.thor.explain([{ to: s.token, value: 0, data: fns.allowance.encode(s.from, s.to) }]).execute()
                    const allowance = out && !out.reverted ? BigInt(fns.allowance.decode(out.data).amount) : 0n
                    const wei = planWei(s)
                    this.left = { ...this.left, [s.id]: wei > 0n ? Number(allowance / wei) : 0 }
                } catch { }
            }
        },
        async cancel(s: Subscription) {
            const comment = this.$t('subs.comment_cancel', { name: s.name || s.to.slice(0, 10) })
            try {
                await this.$signTx(genesises.main.id, { message: [{ ...cancelClause(s), comment }], options: { signer: s.from, comment } })
                s.cancelled = true
                this.$q.notify(this.$t('subs.msg_cancelled'))
            } catch { }
        },
        createPlan() {
            const spec = this.tokens.find(t => t.symbol === this.form.symbol)
            if (!spec || !this.formOk) return
            const p: Plan = { id: newId(), name: this.form.name.trim(), to: this.form.to, symbol: spec.symbol, token: spec.address, decimals: spec.decimals, amount: this.form.amount, every: this.form.every }
            subs.plans = [p, ...subs.plans]
            this.form.name = ''
            this.form.amount = ''
            this.share(p)
        },
        removePlan(p: Plan) {
            this.$q.dialog({ title: this.$t('subs.title_remove'), message: this.$t('subs.msg_remove'), cancel: true })
                .onOk(() => { subs.plans = subs.plans.filter(x => x.id !== p.id) })
        },
        share(p: Plan) {
            this.$qrcode({ title: p.name || this.$t('subs.label_unnamed'), content: planLink(p), message: this.$t('subs.msg_share') })
        },
        async loadSubscribers(p: Plan) {
            this.loadingPlan = p.id
            try {
                this.found = { ...this.found, [p.id]: await findSubscribers(this.thor, p) }
            } catch {
                this.$q.notify({ message: this.$t('common.something_wrong'), color: 'negative' })
            } finally {
                this.loadingPlan = ''
            }
        },
        subState(s: Subscriber): string {
            if (s.collectable) return this.$t('subs.state_due')
            if (s.due) return s.balance === 0n || s.allowance === 0n ? this.$t('subs.state_cannot') : this.$t('subs.state_short')
            return this.$t('subs.state_paid', { when: formatDate(s.lastPaid, { relative: true }) })
        },
        collectable(p: Plan): Subscriber[] {
            return (this.found[p.id] || []).filter(s => s.collectable)
        },
        collectTotal(p: Plan): string {
            return formatUnits(planWei(p) * BigInt(this.collectable(p).length), p.decimals, 2)
        },
        async collect(p: Plan) {
            const list = this.found[p.id] || []
            const clauses = collectClauses(p, list, planWei(p))
            if (!clauses.length) return
            const comment = this.$t('subs.comment_collect', { name: p.name || p.symbol, n: clauses.length })
            this.working = true
            try {
                await this.$signTx(genesises.main.id, { message: clauses.map(c => ({ ...c, comment })), options: { signer: p.to, comment } })
                this.$dialog({ component: SuccessDialog, title: this.$t('subs.title_collected'), message: comment }).catch(() => { })
                setTimeout(() => void this.loadSubscribers(p), 15 * 1000)
            } catch {
                // declined
            } finally {
                this.working = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.sub-row
  padding: 4px 0
  gap: 8px
</style>
