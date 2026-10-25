<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('payout.title')" />
        <page-content
            v-if="wallet"
            class="col"
            padding
        >
            <p class="text-soft">{{$t('payout.msg_intro')}}</p>

            <q-select
                v-model="symbol"
                :options="tokens.map(t => t.symbol)"
                :label="$t('payout.label_token')"
                outlined
                dense
                class="q-mb-md"
            >
                <template #append>
                    <span
                        v-if="balance !== null"
                        class="text-caption text-muted"
                    >{{$t('swap.label_balance')}} {{formatUnits(balance, token?.decimals || 18)}}</span>
                </template>
            </q-select>

            <q-input
                v-model="text"
                type="textarea"
                outlined
                autogrow
                input-class="payout-text"
                :label="$t('payout.label_list')"
                :placeholder="placeholder"
                :hint="$t('payout.hint_list')"
            />
            <div class="row q-gutter-x-sm q-mt-sm">
                <q-btn
                    outline
                    no-caps
                    dense
                    class="q-px-sm"
                    color="primary"
                    icon="o_upload_file"
                    :label="$t('payout.action_load')"
                    @click="($refs.file as HTMLInputElement).click()"
                />
                <q-btn
                    v-if="text"
                    flat
                    no-caps
                    dense
                    class="q-px-sm"
                    :label="$t('payout.action_clear')"
                    @click="text = ''"
                />
                <input
                    ref="file"
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    class="hidden"
                    @change="loadFile"
                >
            </div>

            <!-- what is wrong, line by line -->
            <div
                v-if="parsed.errors.length || unresolved.length"
                class="bvm-tile payout-errors q-mt-md"
                role="alert"
            >
                <div
                    v-for="e in parsed.errors.slice(0, 8)"
                    :key="'e' + e.line"
                >{{$t(e.key === 'address' ? 'payout.err_address' : 'payout.err_amount', { line: e.line })}}</div>
                <div
                    v-for="r in unresolved"
                    :key="'u' + r.line"
                >{{$t('payout.err_name', { line: r.line, name: r.to })}}</div>
                <div v-if="parsed.errors.length > 8">{{$t('payout.err_more', { n: parsed.errors.length - 8 })}}</div>
            </div>

            <!-- the review -->
            <template v-if="ready.length">
                <div class="bvm-tile payout-summary q-mt-md">
                    <div class="row items-baseline">
                        <span class="text-muted">{{$t('payout.label_recipients', { n: ready.length })}}</span>
                        <q-space />
                        <span class="bvm-amount payout-total">{{formatUnits(total, token?.decimals || 18)}} {{symbol}}</span>
                    </div>
                    <div
                        v-if="batches > 1"
                        class="text-muted text-caption"
                    >{{$t('payout.msg_batches', { n: batches })}}</div>
                    <div
                        v-if="short"
                        class="text-negative text-caption"
                    >{{$t('swap.msg_insufficient', { symbol })}}</div>
                </div>
                <q-list class="bvm-list q-mt-sm">
                    <q-item
                        v-for="r in ready.slice(0, shownRows)"
                        :key="r.line"
                        dense
                    >
                        <q-item-section>
                            <q-item-label class="ellipsis">
                                <address-label :addr="r.to" />
                            </q-item-label>
                            <q-item-label
                                v-if="r.note || dup.has(r.to.toLowerCase()) || lookalikes[r.to.toLowerCase()]"
                                caption
                            >
                                <span
                                    v-if="lookalikes[r.to.toLowerCase()]"
                                    class="text-negative text-weight-bold"
                                >{{$t('payout.label_lookalike')}} · </span>
                                <span
                                    v-if="dup.has(r.to.toLowerCase())"
                                    class="text-warning"
                                >{{$t('payout.label_duplicate')}} · </span>{{r.note}}
                            </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <span class="bvm-amount">{{r.amount}}</span>
                        </q-item-section>
                    </q-item>
                </q-list>
                <q-btn
                    v-if="ready.length > shownRows"
                    flat
                    no-caps
                    class="full-width q-mt-xs"
                    :label="$t('payout.action_show_all', { n: ready.length })"
                    @click="shownRows = ready.length"
                />
            </template>
            <div
                v-else-if="!text.trim()"
                class="text-center text-muted q-mt-xl"
            >
                <q-icon
                    name="o_groups"
                    size="40px"
                />
                <div class="q-mt-sm">{{$t('payout.msg_empty')}}</div>
            </div>
        </page-content>
        <page-action v-if="wallet">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_send"
                :loading="paying"
                :disable="!canPay"
                :label="progress || $t('payout.action_pay', { n: ready.length })"
                @click="pay()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import AddressLabel from 'components/AddressLabel.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { BATCH_SIZE, duplicates, parsePayout, payoutBatches, payoutTotal, type PayoutRow } from 'src/utils/payout'
import { isVetName, resolveVetName } from 'src/utils/names'
import { findLookalike } from 'src/utils/recipient'
import { visibleTokens } from 'src/utils/tokens'
import { selectedWallet } from 'src/utils/selection'
import { formatUnits } from 'src/utils/format'

// pay a list of addresses in one go
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel },
    props: {
        wid: String,
        i: String
    },
    data: () => ({
        wallets: [] as M.Wallet[],
        tokens: [] as M.TokenSpec[],
        symbol: 'VET',
        text: '',
        balance: null as bigint | null,
        /** .vet names to their address ('' when they point nowhere) */
        names: {} as Record<string, string>,
        /** recipients that imitate an address you know */
        lookalikes: {} as Record<string, string>,
        shownRows: 30,
        paying: false,
        progress: ''
    }),
    computed: {
        wallet(): M.Wallet | null {
            if (this.wid) {
                return this.wallets.find(w => String(w.id) === this.wid) || null
            }
            return selectedWallet(this.wallets)
        },
        address(): string {
            return this.wallet?.meta.addresses[parseInt(this.i || '0')] || ''
        },
        token(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.symbol)
        },
        placeholder(): string {
            return '0x8b9b…a6f3, 25, Prize\nalice.vet, 10\n0x51a2…77c0; 12,5'
        },
        parsed() {
            return parsePayout(this.text)
        },
        /** rows with an address (names resolved) */
        ready(): PayoutRow[] {
            return this.parsed.rows
                .map(r => isVetName(r.to) ? { ...r, to: this.names[r.to.toLowerCase()] || '' } : r)
                .filter(r => !!r.to)
        },
        unresolved(): PayoutRow[] {
            return this.parsed.rows.filter(r => isVetName(r.to) && this.names[r.to.toLowerCase()] === '')
        },
        dup(): Set<string> {
            return duplicates(this.ready)
        },
        total(): bigint {
            return this.token ? payoutTotal(this.ready, this.token.decimals) : 0n
        },
        short(): boolean {
            return this.balance !== null && this.total > this.balance
        },
        batches(): number {
            return Math.ceil(this.ready.length / BATCH_SIZE)
        },
        canPay(): boolean {
            return !this.paying && !!this.token && this.ready.length > 0 && !this.parsed.errors.length &&
                !this.unresolved.length && this.ready.length === this.parsed.rows.length && !this.short
        }
    },
    watch: {
        symbol() { void this.loadBalance() },
        address() { void this.loadBalance() },
        parsed() { void this.resolve() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = this.wallet
        if (w && this.address) {
            this.tokens = await visibleTokens(this.$svc, w.gid, this.address)
            void this.loadBalance()
        }
    },
    methods: {
        formatUnits,
        async loadBalance() {
            const w = this.wallet
            const t = this.token
            this.balance = null
            if (!w || !t || !this.address) {
                return
            }
            try {
                const b = await this.$svc.bc(w.gid).balanceOf(this.address, t)
                this.balance = BigInt(new BigNumber(b).toFixed(0))
            } catch { }
        },
        loadFile(e: Event) {
            const input = e.target as HTMLInputElement
            const file = input.files?.[0]
            input.value = ''
            if (!file) {
                return
            }
            if (file.size > 512 * 1024) {
                this.$q.notify({ message: this.$t('payout.err_file'), color: 'negative' })
                return
            }
            void file.text().then(t => { this.text = t })
        },
        /** resolve .vet names and look for look-alike addresses */
        async resolve() {
            const w = this.wallet
            if (!w) {
                return
            }
            for (const r of this.parsed.rows) {
                const key = r.to.toLowerCase()
                if (isVetName(r.to) && !(key in this.names)) {
                    this.names = { ...this.names, [key]: (await resolveVetName(r.to).catch(() => null)) || '' }
                }
            }
            const found: Record<string, string> = {}
            for (const r of this.ready) {
                const imitates = await findLookalike(this.$svc, w.gid, r.to)
                if (imitates) found[r.to.toLowerCase()] = imitates
            }
            this.lookalikes = found
        },
        async pay() {
            const w = this.wallet
            const t = this.token
            if (!w || !t || !this.canPay) {
                return
            }
            if (Object.keys(this.lookalikes).length) {
                const go = await new Promise<boolean>(resolve => {
                    this.$q.dialog({
                        title: this.$t('recipientCheck.title_lookalike'),
                        message: this.$t('payout.msg_lookalikes', { n: Object.keys(this.lookalikes).length }),
                        cancel: true,
                        ok: { label: this.$t('recipientCheck.action_continue_anyway'), color: 'negative', flat: true }
                    }).onOk(() => resolve(true)).onCancel(() => resolve(false)).onDismiss(() => resolve(false))
                })
                if (!go) {
                    return
                }
            }
            const batches = payoutBatches(this.ready, { address: t.address, decimals: t.decimals, symbol: t.symbol })
            this.paying = true
            let sent = 0
            try {
                for (const [n, batch] of batches.entries()) {
                    this.progress = batches.length > 1 ? this.$t('payout.label_batch', { n: n + 1, of: batches.length }) : ''
                    const comment = this.$t('payout.comment', { n: batch.length, symbol: t.symbol })
                    await this.$signTx(w.gid, { message: batch, options: { signer: this.address, comment } })
                    sent += batch.length
                }
            } catch {
                // declined: the batches signed so far are on their way
            } finally {
                this.paying = false
                this.progress = ''
            }
            if (sent) {
                this.$dialog({
                    component: SuccessDialog,
                    title: this.$t('payout.title_done'),
                    message: this.$t('payout.msg_done', { n: sent, of: this.ready.length })
                }).catch(() => { })
                if (sent === this.ready.length) {
                    this.text = ''
                }
            }
        }
    }
})
</script>
<style lang="sass" scoped>
:deep(.payout-text)
  font-variant-numeric: tabular-nums
  font-size: 13px
  min-height: 120px

.payout-errors
  padding: 10px 12px
  font-size: 13px
  color: $negative
  border-color: rgba(248, 113, 113, 0.4)

.payout-summary
  padding: 12px 14px

.payout-total
  font-size: 20px
</style>
