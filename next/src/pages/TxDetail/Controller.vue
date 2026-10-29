<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="$t('txDetail.title')"
            :gid="gid"
        />
        <page-content
            class="col"
            padding
        >
            <div
                v-if="loading"
                class="column q-gutter-y-md"
            >
                <q-skeleton
                    type="text"
                    width="60%"
                    height="40px"
                />
                <q-skeleton height="120px" />
                <q-skeleton height="180px" />
            </div>
            <div
                v-else-if="!tx"
                class="text-center text-soft q-pa-lg"
            >{{$t('txDetail.msg_not_found')}}</div>
            <template v-else>
                <div class="row items-center no-wrap q-mb-md">
                    <div
                        class="detail-icon flex flex-center"
                        :class="`detail-icon--${state}`"
                    >
                        <q-icon
                            :name="state === 'failed' ? 'o_error' : state === 'pending' ? 'o_schedule' : 'o_check'"
                            size="24px"
                        />
                    </div>
                    <div
                        class="q-ml-md col"
                        style="min-width: 0"
                    >
                        <h1 class="bvm-display detail-title">{{title}}</h1>
                        <div class="text-muted">{{$t(`txDetail.state_${state}`)}} · {{when}}</div>
                    </div>
                </div>

                <simulation-card
                    v-if="changes"
                    class="q-mb-md"
                    :changes="changes"
                    :gid="gid"
                    :tokens="tokens"
                    :collections="collections"
                    :label="$t('txDetail.label_changes')"
                />

                <div class="bvm-tile detail-rows q-mb-md">
                    <div class="detail-row row no-wrap">
                        <span class="text-muted">{{$t('txDetail.label_from')}}</span>
                        <q-space />
                        <address-label :addr="tx.origin" />
                    </div>
                    <div
                        v-if="firstTo"
                        class="detail-row row no-wrap"
                    >
                        <span class="text-muted">{{$t('txDetail.label_to')}}</span>
                        <q-space />
                        <address-label :addr="firstTo" />
                    </div>
                    <div
                        v-if="receipt"
                        class="detail-row row no-wrap"
                    >
                        <span class="text-muted">{{$t('sign.label_estimate_fee')}}</span>
                        <q-space />
                        <span class="bvm-amount">{{fee}} VTHO<template v-if="sponsored"> · {{$t('txDetail.label_sponsored')}}</template></span>
                    </div>
                    <div
                        v-if="tx.meta"
                        class="detail-row row no-wrap"
                    >
                        <span class="text-muted">{{$t('txDetail.label_block')}}</span>
                        <q-space />
                        <span class="bvm-amount">{{tx.meta.blockNumber.toLocaleString($i18n.locale)}} · {{$t('txDetail.label_confirmations', { n: confirmations })}}</span>
                    </div>
                    <div class="detail-row row no-wrap items-center">
                        <span class="text-muted">{{$t('txDetail.label_id')}}</span>
                        <q-space />
                        <span class="ellipsis tx-id">{{txId.slice(0, 10)}}…{{txId.slice(-8)}}</span>
                        <q-btn
                            :aria-label="$t('common.copy')"
                            flat
                            round
                            dense
                            size="sm"
                            icon="o_content_copy"
                            @click="copy()"
                        />
                    </div>
                </div>

                <!-- the encrypted message that came with it -->
                <div
                    v-if="messageData"
                    class="bvm-tile q-pa-md q-mb-md"
                >
                    <div class="row items-center no-wrap">
                        <q-icon
                            name="o_lock"
                            color="primary"
                            size="20px"
                        />
                        <div class="q-ml-sm text-weight-bold col">{{$t('txDetail.label_message')}}</div>
                        <q-btn
                            v-if="messageText === null"
                            unelevated
                            dense
                            no-caps
                            color="primary"
                            class="q-px-md"
                            :label="$t('txDetail.action_read')"
                            @click="readMessage()"
                        />
                    </div>
                    <p
                        v-if="messageText"
                        class="q-mt-sm q-mb-none message-text"
                    >“{{messageText}}”</p>
                    <p
                        v-else-if="messageError"
                        class="q-mt-sm q-mb-none text-muted"
                    >{{messageError}}</p>
                </div>

                <!-- your note -->
                <q-input
                    v-model="note"
                    outlined
                    dense
                    maxlength="140"
                    :label="$t('txDetail.label_note')"
                    :hint="$t('txDetail.hint_note')"
                    @blur="saveNote()"
                    @keyup.enter="saveNote()"
                >
                    <template #prepend>
                        <q-icon name="o_edit_note" />
                    </template>
                </q-input>

                <div class="column q-gutter-y-sm q-mt-lg">
                    <q-btn
                        v-if="again"
                        unelevated
                        no-caps
                        color="primary"
                        icon="o_replay"
                        :label="$t('txDetail.action_again')"
                        :to="again"
                    />
                    <q-btn
                        v-if="counterparty && !isContact"
                        outline
                        no-caps
                        color="primary"
                        icon="o_person_add"
                        :label="$t('txDetail.action_save_contact')"
                        @click="saveContact()"
                    />
                    <q-btn
                        v-if="state === 'done'"
                        flat
                        no-caps
                        icon="o_receipt_long"
                        :label="$t('receipt.action')"
                        @click="printBon()"
                    />
                    <q-btn
                        v-if="explorer"
                        flat
                        no-caps
                        icon-right="o_open_in_new"
                        :label="$t('txDetail.action_explorer')"
                        @click="openURL(explorer)"
                    />
                </div>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import SimulationCard from 'pages/Sign/SimulationCard.vue'
import ContactDialog from 'pages/Contacts/ContactDialog.vue'
import { balanceChanges, type BalanceChanges } from 'src/utils/simulate'
import { decodeAction } from 'src/utils/actions'
import { describeAction } from 'src/utils/describe-action'
import { formatDate, formatUnits } from 'src/utils/format'
import { setTxNote, txNote } from 'src/utils/tx-notes'
import { decryptMessage, isMessageData } from 'src/utils/message-crypto'
import { Vault } from 'src/core/vault'
import { copyText } from 'src/utils/clipboard'
import { openURL } from 'src/utils/open-url'
import { genesises, urls } from 'src/consts'
import { decodeAsTokenTransferClause } from 'pages/Sign/helper'
import type { Contact } from 'src/utils/names'
import type { BVM } from 'boot/services/bvm'
import type { RouteLocationRaw } from 'vue-router'
import { BigNumber } from 'bignumber.js'
import { printReceipt } from 'src/utils/receipt'

/** an amount as the send form takes it: digits and a dot */
const plain = (v: bigint | string, decimals: number) => new BigNumber(v.toString()).div(new BigNumber(10).pow(decimals)).toFixed()

// one transaction: what it changed for you, the fee, the block, your note
export default defineComponent({
    components: { PageToolbar, PageContent, AddressLabel, SimulationCard },
    props: {
        gid: { type: String, required: true },
        txId: { type: String, required: true },
        /** the address whose view this is */
        me: { type: String, default: '' }
    },
    data() {
        return {
            loading: true,
            tx: null as Connex.Thor.Transaction | null,
            receipt: null as Connex.Thor.Transaction.Receipt | null,
            tokens: [] as M.TokenSpec[],
            collections: {} as Record<string, BVM.Collection>,
            contacts: [] as Contact[],
            note: txNote(this.txId),
            messageText: null as string | null,
            messageError: ''
        }
    },
    computed: {
        thor(): Connex.Thor { return this.$svc.bc(this.gid).thor },
        state(): 'pending' | 'failed' | 'done' {
            if (!this.receipt) return 'pending'
            return this.receipt.reverted ? 'failed' : 'done'
        },
        when(): string {
            const t = this.tx?.meta?.blockTimestamp
            return t ? formatDate(t * 1000, { relative: true }) : ''
        },
        firstTo(): string {
            return this.tx?.clauses[0]?.to || ''
        },
        changes(): BalanceChanges | null {
            if (!this.receipt || this.receipt.reverted) return null
            return balanceChanges(this.receipt.outputs as unknown as Connex.VM.Output[], this.me || this.tx?.origin || '')
        },
        title(): string {
            const tx = this.tx
            if (!tx) return ''
            for (const c of tx.clauses) {
                const action = decodeAction({ to: c.to, value: c.value, data: c.data })
                if (action) {
                    return describeAction(action, {
                        t: (key, params) => this.$t(key, params ?? {}),
                        token: address => this.tokens.find(t => (t.address || '').toLowerCase() === address.toLowerCase()),
                        collection: address => this.collections[address.toLowerCase()]?.name
                    }).text
                }
            }
            // by what changed: only in, only out, or both
            const c = this.changes
            if (c) {
                const ins = (c.vet > 0n ? 1 : 0) + Object.values(c.tokens).filter(v => v > 0n).length + c.nfts.filter(n => n.direction === 'in').length
                const outs = (c.vet < 0n ? 1 : 0) + Object.values(c.tokens).filter(v => v < 0n).length + c.nfts.filter(n => n.direction === 'out').length
                if (ins && !outs) return this.$t('txDetail.title_received')
                if (outs && !ins) return this.$t('txDetail.title_sent')
                if (ins && outs) return this.$t('txDetail.title_exchange')
            }
            const mine = (this.me || '').toLowerCase() === tx.origin.toLowerCase()
            return mine ? this.$t('common.transaction') : this.$t('txDetail.title_received')
        },
        /** an encrypted message clause, if the transaction carries one */
        messageData(): string {
            return this.tx?.clauses.find(c => isMessageData(c.data))?.data || ''
        },
        fee(): string {
            return this.receipt ? formatUnits(BigInt(this.receipt.paid), 18) : ''
        },
        sponsored(): boolean {
            return !!this.receipt && !!this.tx && this.receipt.gasPayer.toLowerCase() !== this.tx.origin.toLowerCase()
        },
        confirmations(): number {
            return this.tx?.meta ? Math.max(0, this.thor.status.head.number - this.tx.meta.blockNumber) : 0
        },
        /** who the other side is: the recipient of what you sent, or the sender of what you got */
        counterparty(): string {
            const tx = this.tx
            if (!tx) return ''
            const mine = (this.me || '').toLowerCase() === tx.origin.toLowerCase()
            if (!mine) return tx.origin
            const c = tx.clauses[0]
            if (!c?.to) return ''
            for (const spec of this.tokens) {
                const t = decodeAsTokenTransferClause({ to: c.to, value: String(c.value), data: c.data }, spec)
                if (t) return t.to
            }
            return (!c.data || c.data === '0x') ? c.to : ''
        },
        isContact(): boolean {
            return this.contacts.some(c => c.address.toLowerCase() === this.counterparty.toLowerCase())
        },
        /** the same payment again, for a plain VET or token transfer you sent */
        again(): RouteLocationRaw | null {
            const tx = this.tx
            if (!tx || tx.clauses.length !== 1 || (this.me || '').toLowerCase() !== tx.origin.toLowerCase()) return null
            const c = tx.clauses[0]!
            if (!c.to) return null
            if ((!c.data || c.data === '0x') && BigInt(c.value) > 0n) {
                return { name: 'send', query: { to: c.to, amount: plain(BigInt(c.value), 18), symbol: 'VET' } }
            }
            for (const spec of this.tokens) {
                const t = decodeAsTokenTransferClause({ to: c.to, value: String(c.value), data: c.data }, spec)
                if (t) return { name: 'send', query: { to: t.to, amount: plain(t.amount, spec.decimals), symbol: spec.symbol } }
            }
            return null
        },
        explorer(): string {
            switch (genesises.which(this.gid)) {
                case 'main': return `${urls.explorerMain}transactions/${this.txId}`
                case 'test': return `${urls.explorerTest}transactions/${this.txId}`
                default: return ''
            }
        }
    },
    async created() {
        try {
            const [tx, receipt, tokens, contacts] = await Promise.all([
                this.thor.transaction(this.txId).get(),
                this.thor.transaction(this.txId).getReceipt(),
                this.$svc.config.token.all(),
                this.$svc.config.getContacts()
            ])
            this.tx = tx
            this.receipt = receipt
            this.tokens = tokens.filter(t => t.gid === this.gid)
            this.contacts = contacts
            if (this.$svc.bvm.supports(this.gid)) {
                this.$svc.bvm.collections().then(c => { this.collections = c }).catch(() => { })
            }
        } catch {
            this.tx = null
        } finally {
            this.loading = false
        }
    },
    methods: {
        /** what moved, as "+12.5 B3TR" lines, for the receipt */
        movedLines(): string[] {
            const c = this.changes
            if (!c) return []
            const out: string[] = []
            const sign = (v: bigint) => v > 0n ? '+' : '−'
            if (c.vet !== 0n) out.push(`${sign(c.vet)}${formatUnits(c.vet < 0n ? -c.vet : c.vet, 18)} VET`)
            for (const [token, v] of Object.entries(c.tokens)) {
                const spec = this.tokens.find(t => (t.address || '').toLowerCase() === token)
                if (!spec || v === 0n) continue
                out.push(`${sign(v)}${formatUnits(v < 0n ? -v : v, spec.decimals)} ${spec.symbol}`)
            }
            return out
        },
        printBon() {
            const tx = this.tx
            if (!tx) return
            const at = tx.meta?.blockTimestamp ? new Date(tx.meta.blockTimestamp * 1000).toLocaleString(this.$i18n.locale) : ''
            const lines = [
                { label: this.$t('receipt.label_date'), value: at },
                ...this.movedLines().map(v => ({ label: this.$t('receipt.label_amount'), value: v })),
                { label: this.$t('txDetail.label_from'), value: tx.origin },
                ...(this.counterparty || this.firstTo ? [{ label: this.$t('txDetail.label_to'), value: this.counterparty || this.firstTo }] : []),
                ...(this.fee ? [{ label: this.$t('sign.label_estimate_fee'), value: `${this.fee} VTHO` }] : []),
                ...(this.note ? [{ label: this.$t('receipt.label_note'), value: this.note }] : []),
                { label: this.$t('txDetail.label_id'), value: this.txId }
            ]
            printReceipt({ title: this.title, lines, link: this.explorer, footer: this.$t('receipt.footer') }, this.$i18n.locale)
        },
        openURL,
        copy() {
            copyText(this.txId).then(() => this.$q.notify(this.$t('common.copied'))).catch(() => { })
        },
        /** decrypt with the key of the address this view is for (sender or recipient) */
        async readMessage() {
            this.messageError = ''
            const me = (this.me || '').toLowerCase()
            const wallets = await this.$svc.wallet.all()
            const wallet = wallets.find(w => w.gid === this.gid && w.meta.addresses.some(a => a.toLowerCase() === me))
            if (!wallet || wallet.meta.type === 'watch') {
                this.messageError = this.$t('txDetail.msg_message_unsupported')
                return
            }
            try {
                const umk = await this.$authenticate()
                const index = wallet.meta.addresses.findIndex(a => a.toLowerCase() === me)
                const sk = Vault.decode(wallet.vault).derive(index).unlock(umk)
                const text = await decryptMessage(this.messageData, sk)
                if (text === null) {
                    this.messageError = this.$t('txDetail.msg_message_not_for_you')
                } else {
                    this.messageText = text
                }
            } catch {
                // cancelled
            }
        },
        saveNote() {
            setTxNote(this.txId, this.note)
        },
        async saveContact() {
            try {
                const c = await this.$dialog<Contact>({ component: ContactDialog, contact: { name: '', address: this.counterparty } })
                const list = [...this.contacts.filter(x => x.address.toLowerCase() !== c.address.toLowerCase()), c]
                await this.$svc.config.saveContacts(list)
                this.contacts = list
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.detail-icon
  width: 48px
  height: 48px
  flex: none
  border-radius: 14px
  background: color-mix(in srgb, var(--q-primary) 12%, transparent)
  color: var(--q-primary)

.detail-icon--failed
  background: rgba(248, 113, 113, 0.10)
  color: $negative

.detail-icon--pending
  background: rgba(251, 191, 36, 0.10)
  color: $warning

.detail-title
  margin: 0
  font-size: 22px
  line-height: 1.2

.detail-rows
  padding: 4px 14px

.detail-row
  padding: 10px 0
  font-size: 14px
  & + &
    border-top: 1px solid $hairline

.tx-id
  font-variant-numeric: tabular-nums

.message-text
  font-size: 16px
  font-weight: 600
</style>
