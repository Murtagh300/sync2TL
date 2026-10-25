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
            <q-item-label header>{{$t('send.label_to')}}</q-item-label>
            <To
                v-model:address="to"
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
            <q-item-label header>{{$t('send.label_amount')}}</q-item-label>
            <q-input
                no-error-icon
                autocomplete="off"
                class="q-mx-md"
                v-model="amount"
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
import { event as gtagEvent } from 'vue-gtag'
import { abi, address } from 'thor-devkit'
import { abis } from 'src/consts'
import To from './To.vue'
import TokenSelector from './TokenSelector.vue'
import { AddressGroup } from './models'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import { toWei } from 'src/utils/format'

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
        symbol: String
    },
    data() {
        return {
            to: null as null | string,
            amount: '',
            sym: this.symbol || 'VET',
            errors: {
                to: '',
                amount: ''
            },
            // async computed (see src/shims-async-computed.d.ts)
            wallet: null as M.Wallet | null,
            recent: [] as string[],
            wallets: [] as M.Wallet[],
            tokenList: [] as M.TokenSpec[]
        }
    },
    asyncComputed: {
        wallet(): Promise<M.Wallet | null> {
            return this.$svc.wallet.get(parseInt(this.wid || ''))
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
                const [tokens = [], activeSymbols = []] = await Promise.all(
                    [
                        this.$svc.config.token.all(),
                        this.$svc.config.token.activeSymbols()
                    ]
                )
                return tokens.filter(token => {
                    return token.gid === w.gid &&
                        (activeSymbols.includes(token.symbol) || token.permanent)
                })
            },
            default: []
        }
    },
    computed: {
        toWallets(): AddressGroup[] {
            let list = [...this.wallets.map<AddressGroup>(w => { return { name: w.meta.name, list: w.meta.addresses } })]
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
            return this.wallet ? this.wallet.meta.addresses[parseInt(this.i || '', 10)] : ''
        },
        address(): string {
            return this.wallet ? this.wallet.meta.addresses[parseInt(this.i || '')] : ''
        }
    },
    methods: {
        isAddress: address.test,
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
            this.errors.to = this.isAddress(this.to)
                ? this.checkSumAddress(this.to) ? '' : this.$t('send.msg_invalid_address_checksum').toString()
                : this.$t('send.msg_invalid_address').toString()

            this.errors.amount = this.balanceCheck(this.amount) ? '' : this.$t('send.msg_invalid_amount').toString()

            return (!this.errors.to && !this.errors.amount)
        },
        onSend() {
            if (!this.validate()) {
                return
            }
            let msgItem!: Connex.Vendor.TxMessage[0]
            let comment = ''
            if (this.sym === 'VET') {
                comment = `${this.$t('send.title')} ${this.amount} VET`
                msgItem = {
                    to: this.to,
                    value: toWei(this.amount, this.currentToken!.decimals),
                    comment
                }
            } else {
                const func = new abi.Function(abis.transfer)
                comment = `${this.$t('send.title')} ${this.amount} ${this.sym}`
                const data = func.encode(this.to, toWei(this.amount, this.currentToken!.decimals))
                msgItem = {
                    to: this.currentToken!.address,
                    value: 0,
                    data: data,
                    comment
                }
            }
            this.$signTx(this.wallet!.gid, {
                message: [msgItem],
                options: {
                    signer: this.from,
                    comment: comment
                }
            }).then(() => {
                // eslint-disable-next-line @typescript-eslint/camelcase
                gtagEvent('token-send', { event_label: this.sym })
                const temp = [this.to, ...this.recent].reduce((result: string[], cv: string | null) => {
                    (cv && !result.includes(cv.toLowerCase())) && result.push(cv.toLowerCase())
                    return result
                }, []).slice(0, 10)
                if (this.wallet) {
                    this.$svc.config.saveRecentRecipients(this.wallet.gid, temp)
                }
                this.$router.replace({ name: 'sign-success', query: { type: 'tx' } })
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
</style>
