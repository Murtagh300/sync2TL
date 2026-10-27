<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('vebetter.title')">
            <q-btn
                flat
                round
                icon="o_open_in_new"
                :aria-label="$t('a11y.open_external')"
                @click="openURL('https://governance.vebetterdao.org')"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('vebetter.msg_intro')}}</p>
            <q-select
                v-if="addresses.length > 1"
                v-model="address"
                :options="addresses"
                emit-value
                map-options
                outlined
                dense
                class="q-mb-md"
                :label="$t('wc.label_address')"
            />
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 3"
                    :key="i"
                    height="72px"
                />
            </div>
            <empty-state
                v-else-if="!info"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <template v-else>
                <div class="row q-col-gutter-sm">
                    <div class="col-6">
                        <div class="bvm-tile tile">
                            <div class="text-muted tile-label">B3TR</div>
                            <div class="bvm-amount tile-value">{{formatUnits(info.b3tr, 18, 2)}}</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="bvm-tile tile">
                            <div class="text-muted tile-label">VOT3<help-tip term="vot3" /></div>
                            <div class="bvm-amount tile-value">{{formatUnits(info.vot3, 18, 2)}}</div>
                        </div>
                    </div>
                </div>

                <!-- the allocation round -->
                <div class="bvm-tile tile q-mt-sm row no-wrap items-center">
                    <q-icon
                        name="o_how_to_vote"
                        size="26px"
                        color="primary"
                    />
                    <div class="col q-ml-md">
                        <div class="text-weight-bold">{{$t('vebetter.label_round', { n: info.round })}}</div>
                        <div class="text-caption text-muted">{{roundText}}</div>
                    </div>
                    <q-btn
                        outline
                        dense
                        no-caps
                        color="primary"
                        class="q-px-sm"
                        :label="$t('vebetter.action_vote')"
                        @click="openURL('https://governance.vebetterdao.org')"
                    />
                </div>

                <!-- convert -->
                <div class="bvm-tile tile q-mt-sm">
                    <div class="text-weight-bold q-mb-sm">{{$t('vebetter.title_convert')}}</div>
                    <q-btn-toggle
                        v-model="direction"
                        spread
                        no-caps
                        unelevated
                        toggle-color="primary"
                        color="dark"
                        class="q-mb-sm"
                        :options="[{ label: 'B3TR → VOT3', value: 'toVOT3' }, { label: 'VOT3 → B3TR', value: 'toB3TR' }]"
                    />
                    <q-input
                        v-model="amount"
                        outlined
                        dense
                        inputmode="decimal"
                        :label="$t('send.label_amount')"
                        :error="!!amountError"
                        :error-message="amountError"
                        no-error-icon
                    >
                        <template #append>
                            <q-btn
                                flat
                                dense
                                no-caps
                                size="sm"
                                color="primary"
                                :label="$t('swap.action_max')"
                                @click="amount = plainUnits(available, 18)"
                            />
                        </template>
                    </q-input>
                    <div class="text-caption text-muted q-mb-sm">{{$t(direction === 'toVOT3' ? 'vebetter.msg_to_vot3' : 'vebetter.msg_to_b3tr')}}</div>
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        class="full-width"
                        :disable="!amountWei || !!amountError || !signable"
                        :label="$t('vebetter.action_convert')"
                        @click="convert()"
                    />
                    <div
                        v-if="!signable"
                        class="text-caption text-warning q-mt-xs"
                    >{{$t('watch.msg_cannot_sign')}}</div>
                </div>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import HelpTip from 'components/HelpTip.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { blockTime, convertClauses, veBetterInfo, type VeBetterInfo } from 'src/utils/ecosystem'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatUnits, formatDate, plainUnits, toWei } from 'src/utils/format'
import { openURL } from 'src/utils/open-url'
import { genesises } from 'src/consts'

// VeBetterDAO: B3TR, VOT3 to vote with, and the current allocation round
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, HelpTip },
    data: () => ({
        wallets: [] as M.Wallet[],
        address: '',
        info: null as VeBetterInfo | null,
        loading: true,
        direction: 'toVOT3' as 'toVOT3' | 'toB3TR',
        amount: ''
    }),
    computed: {
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets.filter(w => w.gid === genesises.main.id))
        },
        addresses(): { label: string, value: string }[] {
            return (this.wallet?.meta.addresses || []).map((a, k) => ({ label: `#${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a }))
        },
        signable(): boolean {
            return canSign(this.wallet)
        },
        available(): bigint {
            if (!this.info) return 0n
            return this.direction === 'toVOT3' ? this.info.b3tr : this.info.unlocked
        },
        amountWei(): bigint | null {
            const a = this.amount.trim().replace(',', '.')
            if (!/^\d+(\.\d+)?$/.test(a)) return null
            const wei = BigInt(toWei(a, 18))
            return wei > 0n ? wei : null
        },
        amountError(): string {
            if (!this.amount.trim()) return ''
            if (this.amountWei === null) return this.$t('send.msg_invalid_amount')
            if (this.amountWei > this.available) return this.$t('swap.msg_insufficient', { symbol: this.direction === 'toVOT3' ? 'B3TR' : 'VOT3' })
            return ''
        },
        roundText(): string {
            if (!this.info) return ''
            const head = this.$svc.bc(genesises.main.id).thor.status.head
            const when = formatDate(blockTime(this.info.deadlineBlock, head.number, head.timestamp), { relative: true })
            return `${this.$t('vebetter.label_ends', { when })} · ${this.$t(this.info.voted ? 'vebetter.label_voted' : 'vebetter.label_not_voted')}`
        }
    },
    watch: {
        address() { void this.load() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        this.address = this.wallet?.meta.addresses[0] || ''
        if (!this.address) this.loading = false
    },
    methods: {
        formatUnits,
        plainUnits,
        openURL,
        async load() {
            if (!this.address) return
            this.loading = true
            try {
                this.info = await veBetterInfo(this.$svc.bc(genesises.main.id).thor, this.address)
            } catch (err) {
                console.warn('vebetter:', err)
                this.info = null
            } finally {
                this.loading = false
            }
        },
        async convert() {
            const amount = this.amountWei
            if (!amount || !this.signable) return
            const text = formatUnits(amount, 18, 4)
            const comment = this.$t(this.direction === 'toVOT3' ? 'vebetter.comment_to_vot3' : 'vebetter.comment_to_b3tr', { amount: text })
            try {
                await this.$signTx(genesises.main.id, {
                    message: convertClauses(this.direction, amount).map(c => ({ ...c, comment })),
                    options: { signer: this.address, comment }
                })
                this.amount = ''
                this.$dialog({ component: SuccessDialog, title: this.$t('vebetter.title_converted'), message: comment }).catch(() => { })
                setTimeout(() => void this.load(), 12 * 1000)
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.tile
  padding: 12px 14px

.tile-label
  font-size: 12px
  font-weight: 700

.tile-value
  font-size: 18px
  margin-top: 2px
</style>
