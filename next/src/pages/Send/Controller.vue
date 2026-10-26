<template>
    <q-form
        class="column fit no-wrap"
        v-if="tokenList.length"
        @submit="onSend"
    >
        <page-toolbar
            :title="$t('send.title')"
            :gid="wallet?.gid"
        />
        <page-content class="col no-wrap">
            <div
                v-if="wallet && !canSign(wallet)"
                class="bvm-tile q-ma-md q-pa-md text-warning"
                role="alert"
            >{{$t('watch.msg_cannot_sign')}}</div>
            <q-item-label header>{{$t('send.label_to')}}</q-item-label>
            <To
                v-model:address="recipient"
                @request="onRequest"
                class="q-mx-md"
                :wallets="toWallets"
                :error-message="errors.to"
                :error="!!errors.to"
                @update:address="errors.to = ''"
            />
            <q-item-label header>{{$t('send.label_asset')}}</q-item-label>
            <TokenSelector
                :tokens="tokenList"
                v-model:symbol="sym"
                :address="address"
            />
            <div class="row items-center no-wrap q-pr-md">
                <q-item-label header>{{$t('send.label_amount')}}</q-item-label>
                <q-space />
                <q-btn-toggle
                    v-if="unitPrice"
                    v-model="fiatMode"
                    dense
                    no-caps
                    unelevated
                    size="sm"
                    toggle-color="primary"
                    color="dark"
                    :options="[{ label: sym, value: false }, { label: prefs.currency === 'EUR' ? '€' : '$', value: true }]"
                />
            </div>
            <q-input
                v-if="!fiatMode"
                no-error-icon
                autocomplete="off"
                class="q-mx-md"
                v-model="amountText"
                :aria-label="$t('send.label_amount')"
                :error-message="errors.amount"
                :error="!!errors.amount"
                @update:model-value="errors.amount = ''"
                input-class="send-amount bvm-display"
                type="text"
                inputmode="decimal"
                placeholder="0.00"
                outlined
                spellcheck="false"
            />
            <q-input
                v-else
                no-error-icon
                autocomplete="off"
                class="q-mx-md"
                v-model="fiatText"
                :aria-label="$t('send.label_amount')"
                :error-message="errors.amount"
                :error="!!errors.amount"
                @update:model-value="onFiat"
                input-class="send-amount bvm-display"
                type="text"
                inputmode="decimal"
                placeholder="0.00"
                outlined
                spellcheck="false"
                :prefix="prefs.currency === 'EUR' ? '€' : '$'"
            />
            <div class="row items-center no-wrap q-px-md q-mt-xs">
                <div class="text-muted conversion ellipsis">{{conversion}}</div>
                <q-space />
                <div
                    v-if="balance"
                    class="row no-wrap q-gutter-x-xs"
                >
                    <q-btn
                        v-for="p in [25, 50, 75, 100]"
                        :key="p"
                        outline
                        dense
                        no-caps
                        size="sm"
                        class="pct"
                        :label="p === 100 ? $t('swap.action_max') : `${p}%`"
                        @click="setPart(p)"
                    />
                </div>
            </div>
            <q-item-label header>{{$t('send.label_message')}}</q-item-label>
            <q-input
                v-model="message"
                :aria-label="$t('send.label_message')"
                class="q-mx-md"
                outlined
                dense
                :maxlength="200"
                :placeholder="$t('send.placeholder_message')"
                :error="!!messageError"
                :error-message="messageError"
                no-error-icon
                @update:model-value="messageError = ''"
            >
                <template #prepend>
                    <q-icon name="o_lock" />
                </template>
            </q-input>
            <q-item-label header>{{$t('send.label_note')}}</q-item-label>
            <q-input
                v-model="note"
                :aria-label="$t('send.label_note')"
                class="q-mx-md"
                outlined
                dense
                maxlength="140"
                :placeholder="$t('send.placeholder_note')"
            >
                <template #prepend>
                    <q-icon name="o_edit_note" />
                </template>
            </q-input>
        </page-content>
        <page-action>
            <q-btn
                type="submit"
                unelevated
                no-caps
                size="lg"
                icon="o_north_east"
                color="primary"
                :label="$t('send.action_send')"
            />
        </page-action>
    </q-form>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { rememberPayment } from 'src/utils/last-payments'
import { canSign } from 'src/utils/watch'
import { event as gtagEvent } from 'vue-gtag'
import { visibleTokens } from 'src/utils/tokens'
import { abi, address } from 'thor-devkit'
import { abis } from 'src/consts'
import To from './To.vue'
import TokenSelector from './TokenSelector.vue'
import { AddressGroup } from './models'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import { toWei } from 'src/utils/format'
import { genesises } from 'src/consts'
import { BigNumber } from 'bignumber.js'
import { money, prefs } from 'src/utils/prefs'
import { setTxNote } from 'src/utils/tx-notes'
import { advance, payments } from 'src/utils/payments'
import { encryptMessage, publicKeyOf } from 'src/utils/message-crypto'
import { Vault } from 'src/core/vault'
import type { Contact } from 'src/utils/names'
import type { PaymentRequest } from 'src/utils/payment-request'
import SuccessDialog from 'components/SuccessDialog.vue'
import RecipientCheckDialog from './RecipientCheckDialog.vue'
import { findLookalike, isKnownRecipient } from 'src/utils/recipient'
import { nameOf } from 'src/utils/names'

export default defineComponent({
    components: {
        To,
        TokenSelector,
        PageToolbar,
        PageContent,
        PageAction
    },
    props: {
        wid: String,
        i: String,
        symbol: String,
        // a payment request (see src/utils/payment-request.ts)
        to: String,
        amount: String,
        /** the scheduled payment this pays (pages/Payments) */
        schedule: String
    },
    data() {
        return {
            recipient: (this.to || null) as null | string,
            amountText: this.amount || '',
            fiatText: '',
            message: '',
            messageError: '',
            fiatMode: false,
            note: (this.schedule && payments.scheduled.find(x => x.id === this.schedule)?.note) || '',
            prefs,
            unitPrice: 0,
            fx: 1,
            balance: '' as string,
            sym: this.symbol || 'VET',
            errors: {
                to: '',
                amount: ''
            },
            // async computed (see src/shims-async-computed.d.ts)
            wallet: null as M.Wallet | null,
            recent: [] as string[],
            contacts: [] as Contact[],
            wallets: [] as M.Wallet[],
            tokenList: [] as M.TokenSpec[]
        }
    },
    asyncComputed: {
        async wallet(): Promise<M.Wallet | null> {
            if (this.wid) {
                return this.$svc.wallet.get(parseInt(this.wid))
            }
            // a payment link names no wallet: the first one on mainnet that can sign
            const [first] = (await this.$svc.wallet.getByGid(genesises.main.id)).filter(canSign)
            return first || null
        },
        recent: {
            async get(): Promise<string[]> {
                if (!this.wallet) {
                    return []
                }
                return this.$svc.config.getRecentRecipients(this.wallet.gid)
            },
            default: []
        },
        contacts: {
            get(): Promise<Contact[]> {
                return this.$svc.config.getContacts()
            },
            default: []
        },
        wallets: {
            async get(): Promise<M.Wallet[]> {
                if (!this.wallet) {
                    return []
                }
                return await this.$svc.wallet.getByGid(this.wallet.gid)
            },
            default: []
        },
        tokenList: {
            async get(): Promise<M.TokenSpec[]> {
                const w = this.wallet
                if (!w) {
                    return []
                }
                return visibleTokens(this.$svc, w.gid, w.meta.addresses[parseInt(this.i || '0')] || '')
            },
            default: []
        }
    },
    watch: {
        currentToken() { void this.loadTokenInfo() },
        from() { void this.loadTokenInfo() },
        fiatMode(on: boolean) {
            // keep the amount when switching
            if (on && this.amountText && this.unitPrice) {
                this.fiatText = new BigNumber(this.amountText).times(this.unitPrice).toFixed(2)
            }
        }
    },
    computed: {
        /** the other unit of what is typed */
        conversion(): string {
            const amount = parseFloat(this.amountText)
            if (!this.unitPrice || !isFinite(amount) || amount <= 0) {
                return ''
            }
            return this.fiatMode ? `≈ ${new BigNumber(this.amountText).decimalPlaces(4, BigNumber.ROUND_FLOOR).toFormat()} ${this.sym}` : `≈ ${money(amount * this.unitPrice)}`
        },
        toWallets(): AddressGroup[] {
            let list = [...this.wallets.map<AddressGroup>(w => { return { name: w.meta.name, list: w.meta.addresses } })]
            if (this.contacts.length) {
                list = [
                    {
                        name: this.$t('contacts.title').toString(),
                        list: this.contacts.map(c => c.address)
                    },
                    ...list
                ]
            }
            if (this.recent.length) {
                list = [
                    {
                        name: this.$t('send.label_recent_transfer').toString(),
                        list: this.recent
                    },
                    ...list
                ]
            }
            return list
        },
        currentToken(): M.TokenSpec | undefined {
            return this.tokenList.find(item => item.symbol === this.sym)
        },
        from(): string {
            return this.wallet ? (this.wallet.meta.addresses[parseInt(this.i || '0')] ?? '') : ''
        },
        address(): string {
            return this.wallet ? (this.wallet.meta.addresses[parseInt(this.i || '0')] ?? '') : ''
        }
    },
    methods: {
        isAddress: address.test,
        /** the message as clause data for the recipient and this address; null when it can't be */
        async encryptFor(to: string, text: string): Promise<string | null> {
            const w = this.wallet!
            try {
                const bc = this.$svc.bc(w.gid)
                const [theirs, mine] = await Promise.all([
                    publicKeyOf(bc.thor, bc.nodeUrl, to),
                    Promise.resolve(Vault.decode(w.vault).derive(parseInt(this.i || '0')).publicKey)
                ])
                if (!theirs) {
                    this.messageError = this.$t('send.msg_no_pubkey')
                    return null
                }
                return await encryptMessage(text, mine ? [theirs, mine] : [theirs])
            } catch {
                this.messageError = this.$t('common.something_wrong')
                return null
            }
        },
        /** price and balance of the token being sent */
        async loadTokenInfo() {
            const w = this.wallet
            const t = this.currentToken
            this.balance = ''
            this.unitPrice = 0
            if (!w || !t || !this.from) {
                return
            }
            this.$svc.bc(w.gid).balanceOf(this.from, t).then(b => { this.balance = b }).catch(() => { })
            if (this.$svc.bvm.supports(w.gid)) {
                const [stats, fx] = await Promise.all([this.$svc.prices.stats([t.address]).catch(() => ({})), this.$svc.prices.fx(prefs.currency)])
                const s = (stats as Record<string, { price: number }>)[(t.address || '0x0000000000000000000000000000000000000000').toLowerCase()]
                this.fx = fx
                this.unitPrice = s ? s.price * fx : 0
            }
            if (!this.unitPrice) {
                this.fiatMode = false
            }
        },
        onFiat(v: string | number | null) {
            this.errors.amount = ''
            const fiat = parseFloat(String(v || '').replace(',', '.'))
            if (!this.unitPrice || !isFinite(fiat) || fiat <= 0) {
                this.amountText = ''
                return
            }
            const decimals = Math.min(this.currentToken?.decimals ?? 18, 6)
            this.amountText = new BigNumber(fiat).div(this.unitPrice).toFixed(decimals, BigNumber.ROUND_FLOOR).replace(/\.?0+$/, '')
        },
        setPart(percent: number) {
            const t = this.currentToken
            if (!t || !this.balance) {
                return
            }
            let wei = new BigNumber(this.balance)
            if (percent === 100 && t.symbol === 'VTHO') {
                // the fee is paid in VTHO: keep some
                wei = BigNumber.max(wei.minus(new BigNumber(20).times(1e18)), 0)
            } else {
                wei = wei.times(percent).div(100).integerValue(BigNumber.ROUND_FLOOR)
            }
            this.amountText = wei.div(new BigNumber(10).pow(t.decimals)).toFixed()
            this.fiatText = this.unitPrice ? new BigNumber(this.amountText).times(this.unitPrice).toFixed(2) : ''
            this.errors.amount = ''
        },
        onRequest(req: PaymentRequest) {
            if (req.amount) {
                this.amountText = req.amount
            }
            if (req.symbol && this.tokenList.some(t => t.symbol === req.symbol)) {
                this.sym = req.symbol
            }
        },
        checkSumAddress(v: string): boolean {
            return !(v !== v.toLowerCase() && address.toChecksumed(v) !== v)
        },
        balanceCheck(v: string): boolean {
            let pattern = '^(([1-9]{1}\\d*)|(0{1}))'
            if (this.currentToken!.decimals > 0) {
                pattern += `(\\.\\d{1,${this.currentToken!.decimals}})?$`
            } else {
                pattern += '$'
            }
            const regexp = new RegExp(pattern)
            return regexp.test(v) ? parseFloat(v) > 0 : false
        },
        validate(): boolean {
            this.errors.to = this.isAddress(this.recipient)
                ? this.checkSumAddress(this.recipient) ? '' : this.$t('send.msg_invalid_address_checksum').toString()
                : this.$t('send.msg_invalid_address').toString()

            this.errors.amount = this.balanceCheck(this.amountText) ? '' : this.$t('send.msg_invalid_amount').toString()

            return (!this.errors.to && !this.errors.amount)
        },
        canSign,
        async onSend() {
            if (!canSign(this.wallet)) {
                this.$q.notify({ message: this.$t('watch.msg_cannot_sign'), color: 'negative' })
                return
            }
            if (!this.validate()) {
                return
            }
            if (!await isKnownRecipient(this.$svc, this.wallet!.gid, this.recipient!)) {
                try {
                    const imitates = await findLookalike(this.$svc, this.wallet!.gid, this.recipient!)
                    await this.$dialog({ component: RecipientCheckDialog, to: this.recipient!, imitates })
                } catch {
                    return
                }
            }
            let msgItem!: Connex.Vendor.TxMessage[0]
            let comment = ''
            if (this.sym === 'VET') {
                comment = `${this.$t('send.title')} ${this.amountText} VET`
                msgItem = {
                    to: this.recipient,
                    value: toWei(this.amountText, this.currentToken!.decimals),
                    comment
                }
            } else {
                const func = new abi.Function(abis.transfer)
                comment = `${this.$t('send.title')} ${this.amountText} ${this.sym}`
                const data = func.encode(this.recipient, toWei(this.amountText, this.currentToken!.decimals))
                msgItem = {
                    to: this.currentToken!.address,
                    value: 0,
                    data: data,
                    comment
                }
            }
            const clauses: Connex.Vendor.TxMessage = [msgItem]
            if (this.message.trim()) {
                const data = await this.encryptFor(this.recipient!, this.message.trim())
                if (!data) {
                    return
                }
                clauses.push({ to: this.recipient, value: 0, data, comment: this.$t('send.comment_message') })
            }
            this.$signTx(this.wallet!.gid, {
                message: clauses,
                options: {
                    signer: this.from,
                    comment: comment
                }
            }).then((resp) => {
                const s = this.schedule && payments.scheduled.find(x => x.id === this.schedule)
                if (s) {
                    advance(s)
                }
                if (this.note.trim()) {
                    setTxNote(resp.txid, this.note)
                }
                gtagEvent('token-send', { event_label: this.sym })
                const temp = [this.recipient, ...this.recent].reduce((result: string[], cv: string | null) => {
                    (cv && !result.includes(cv.toLowerCase())) && result.push(cv.toLowerCase())
                    return result
                }, []).slice(0, 10)
                if (this.wallet) {
                    this.$svc.config.saveRecentRecipients(this.wallet.gid, temp)
                }
                rememberPayment(this.recipient!, this.amountText, this.sym)
                this.$dialog({
                    component: SuccessDialog,
                    title: this.$t('send.title_sent'),
                    message: this.$t('send.msg_sent'),
                    lines: [
                        { label: this.$t('send.label_amount'), value: `${this.amountText} ${this.sym}` },
                        { label: this.$t('send.label_to'), value: nameOf(this.recipient) || `${this.recipient!.slice(0, 8)}…${this.recipient!.slice(-6)}` }
                    ]
                }).catch(() => { }).finally(() => this.$backOrHome())
            })
        }
    }
})
</script>
<style lang="sass">
// the amount being sent is the biggest thing on the page
.send-amount
  font-size: 34px !important
  height: 56px

.conversion
  font-size: 13px
  font-variant-numeric: tabular-nums

.pct
  min-width: 44px
  border-radius: 8px
  font-weight: 800
</style>
