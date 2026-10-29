<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('subs.title_subscribe')" />
        <page-content
            class="col"
            padding
        >
            <empty-state
                v-if="problem"
                icon="o_link_off"
                :text="problem"
            />
            <template v-else-if="spec">
                <div class="bvm-tile plan q-mb-md">
                    <div class="text-muted plan-label">{{$t('subs.label_plan')}}</div>
                    <div class="bvm-display plan-name">{{name || $t('subs.label_unnamed')}}</div>
                    <div class="bvm-amount plan-price q-mt-xs">{{amount}} {{spec.symbol}} {{$t(`subs.per_${every}`)}}</div>
                    <div class="text-muted q-mt-sm">{{$t('subs.label_to')}} <address-label :addr="to" /></div>
                </div>
                <q-select
                    v-if="addresses.length > 1"
                    v-model="from"
                    :options="addresses"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('subs.label_from')"
                    class="q-mb-md"
                />
                <p class="text-soft">{{$t('subs.msg_how', { amount: `${amount} ${spec.symbol}`, n: PERIODS })}}</p>
                <p class="text-caption text-muted">{{$t('subs.msg_cancel')}}</p>
            </template>
        </page-content>
        <page-action v-if="spec && !problem">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_autorenew"
                :disable="!from || working"
                :loading="working"
                :label="$t('subs.action_subscribe', { amount: `${amount} ${spec.symbol}` })"
                @click="subscribe()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address as addr } from 'thor-devkit'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import EmptyState from 'components/EmptyState.vue'
import AddressLabel from 'components/AddressLabel.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { newId } from 'src/utils/payments'
import { PERIODS, planWei, subs, subscribeClauses, type Every } from 'src/utils/subscriptions'

const isAddress = (v: string): boolean => addr.test(v)

// a subscription link from a seller: pay the first period, allow the next ones
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, EmptyState, AddressLabel },
    props: {
        to: { type: String, default: '' },
        amount: { type: String, default: '' },
        symbol: { type: String, default: '' },
        every: { type: String, default: 'month' },
        name: { type: String, default: '' }
    },
    data: () => ({
        PERIODS,
        wallets: [] as M.Wallet[],
        tokens: [] as M.TokenSpec[],
        from: '',
        working: false,
        loaded: false
    }),
    computed: {
        spec(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.symbol)
        },
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id && canSign(w))
                .flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        problem(): string {
            if (!this.loaded) return ''
            if (!isAddress(this.to) || !/^\d+(\.\d+)?$/.test(this.amount) || !(parseFloat(this.amount) > 0) || !['week', 'month'].includes(this.every)) return this.$t('subs.msg_bad_link')
            if (this.symbol === 'VET') return this.$t('subs.msg_no_vet')
            if (!this.spec) return this.$t('subs.msg_unknown_token', { symbol: this.symbol })
            if (!this.addresses.length) return this.$t('common.no_wallet')
            if (this.addresses.some(a => a.value.toLowerCase() === this.to.toLowerCase())) return this.$t('subs.msg_own')
            return ''
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        this.tokens = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id && t.symbol !== 'VET')
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id && canSign(x)))
        this.from = w?.meta.addresses[0] || this.addresses[0]?.value || ''
        this.loaded = true
    },
    methods: {
        async subscribe() {
            const spec = this.spec
            if (!spec || this.problem) return
            const plan = { id: newId(), name: this.name.slice(0, 60), to: addr.toChecksumed(this.to), symbol: spec.symbol, token: spec.address, decimals: spec.decimals, amount: this.amount, every: this.every as Every }
            const comment = this.$t('subs.comment_subscribe', { name: plan.name || plan.to.slice(0, 10), amount: `${plan.amount} ${plan.symbol}` })
            this.working = true
            try {
                await this.$signTx(genesises.main.id, {
                    message: subscribeClauses(plan, planWei(plan)).map(c => ({ ...c, comment })),
                    options: { signer: this.from, comment }
                })
                subs.subscriptions = [{ ...plan, from: this.from, gid: genesises.main.id, startedAt: Date.now() }, ...subs.subscriptions]
                this.$dialog({ component: SuccessDialog, title: this.$t('subs.title_subscribed'), message: this.$t('subs.msg_subscribed') }).catch(() => { })
                void this.$router.replace({ name: 'subscriptions' })
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
.plan
  padding: 16px

.plan-label
  font-size: 12px
  font-weight: 700

.plan-name
  font-size: 22px
  word-break: break-word

.plan-price
  font-size: 18px
</style>
