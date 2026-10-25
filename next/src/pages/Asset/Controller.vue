<template>
    <div
        class="fit column no-wrap"
        v-if="wallet"
    >
        <page-toolbar
            :title="$t('asset.title')"
            :gid="wallet.gid"
        />
        <page-content>
            <async-resolve
                v-if="token"
                :promise="$svc.bc(token.gid).balanceOf(address, token)"
                v-slot={data}
            >
                <head-item
                    :token="token"
                    :balance="data"
                >
                    <div class="text-weight-bold">{{token.name}}</div>
                    <div class="text-muted ellipsis" style="font-size: 12px">
                        {{wallet.meta.name}} · <address-label :addr="address" />
                    </div>
                    <template #balance>
                        <div class="asset-balance bvm-display ellipsis">
                            <amount-label
                                :value="data"
                                :decimals="token.decimals"
                            >--.--</amount-label>
                        </div>
                        <div class="asset-symbol">{{token.symbol}}</div>
                    </template>
                    <template #action>
                        <q-btn
                            unelevated
                            no-caps
                            color="primary"
                            icon="o_north_east"
                            class="full-width q-mt-md"
                            :label="$t('send.action_send')"
                            :to="{name: 'send', query: { wid: walletId, i: addressIndex, symbol: symbol }}"
                        />
                    </template>
                </head-item>
            </async-resolve>
            <div class="bvm-label q-px-md q-pt-lg q-pb-sm">{{$t('asset.label_history')}}</div>
        </page-content>
        <page-content class="col">
            <Logs
                v-if="token"
                :address="address"
                :token="token"
                :pageSize="20"
            />
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Logs from './Logs.vue'
import HeadItem from './HeadItem.vue'
import AsyncResolve from 'components/AsyncResolve'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import AmountLabel from 'components/AmountLabel.vue'
export default defineComponent({
    components: {
        Logs,
        HeadItem,
        AsyncResolve,
        PageToolbar,
        PageContent,
        AddressLabel,
        AmountLabel
    },
    data() {
        return {
            showQR: false,
            // async computed (see src/shims-async-computed.d.ts)
            wallet: null as M.Wallet | null,
            token: null as M.TokenSpec | null
        }
    },
    props: {
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true },
        symbol: { type: String, required: true }
    },
    asyncComputed: {
        wallet(): Promise<M.Wallet | null> {
            return this.$svc.wallet.get(parseInt(this.walletId))
        },
        token: {
            async get(): Promise<M.TokenSpec | null> {
                const wallet = this.wallet
                if (!wallet) {
                    return null
                }
                const [tokens, activeSymbols] = await Promise.all([
                    this.$svc.config.token.all(),
                    this.$svc.config.token.activeSymbols()
                ])
                return tokens.filter(token => {
                    return token.gid === wallet.gid &&
                        (activeSymbols.includes(token.symbol) || token.permanent)
                }).find(token => token.symbol === this.symbol) || null
            },
            default: null
        }
    },
    computed: {
        address(): string {
            return this.wallet ? this.wallet.meta.addresses[parseInt(this.addressIndex)] : ''
        }
    }
})
</script>
<style lang="sass" scoped>
.asset-balance
  font-size: clamp(40px, 12vw, 56px)

.asset-symbol
  margin-top: 4px
  font-size: 13px
  font-weight: 800
  color: $text-soft
</style>
