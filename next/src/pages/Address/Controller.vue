<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="$t('address.title')"
            :gid="wallet?.gid"
        />
        <template v-if="wallet">
            <page-content>
                <head-item
                    :address="address"
                    :name="wallet.meta.name"
                />
                <div class="row items-center q-px-md q-pt-md">
                    <div class="bvm-label">{{$t('address.label_assets')}}</div>
                    <q-btn
                        class="q-ml-auto"
                        :to="{name: 'tokens-setting'}"
                        flat
                        round
                        dense
                        color="primary"
                        icon="o_tune"
                    />
                </div>
            </page-content>
            <page-content class="col">
                <q-list>
                    <async-resolve
                        v-for="(token, index) in tokenList"
                        tag="div"
                        :promise="$svc.bc(token.gid).balanceOf(address, token)"
                        v-slot="{data}"
                        :key="token.symbol"
                    >
                        <q-separator
                            v-if="index !== 0"
                            inset="item"
                        />
                        <token-item
                            :token="token"
                            :balance="data"
                        >
                            <q-btn
                                outline
                                no-caps
                                color="primary"
                                icon="o_history"
                                :label="$t('asset.label_history')"
                                :to="{
                                    name: 'asset',
                                    params: {
                                        walletId: walletId,
                                        addressIndex: addressIndex,
                                        symbol: token.symbol
                                    }
                                }"
                            />
                            <q-btn
                                unelevated
                                no-caps
                                color="primary"
                                icon="o_north_east"
                                :label="$t('send.action_send')"
                                :to="{
                                    name: 'send',
                                    query: { wid: walletId, i: addressIndex, symbol: token.symbol }
                                }"
                            />
                        </token-item>
                    </async-resolve>
                </q-list>
            </page-content>
        </template>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import TokenItem from './TokenItem.vue'
import HeadItem from './HeadItem.vue'
import AsyncResolve from 'components/AsyncResolve'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'

export default defineComponent({
    components: {
        TokenItem,
        HeadItem,
        AsyncResolve,
        PageToolbar,
        PageContent
    },
    props: {
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true }
    },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        wallet: null as M.Wallet | null,
        tokenList: [] as M.TokenSpec[]
    }),
    asyncComputed: {
        wallet(): Promise<M.Wallet | null> {
            return this.$svc.wallet.get(parseInt(this.walletId))
        },
        tokenList: {
            async get(): Promise<M.TokenSpec[]> {
                const wallet = this.wallet
                if (!wallet) {
                    return []
                }
                const [tokens, activeSymbols] = await Promise.all([
                    this.$svc.config.token.all(),
                    this.$svc.config.token.activeSymbols()
                ])
                return tokens.filter(token => token.gid === wallet.gid && (activeSymbols.includes(token.symbol) || token.permanent))
            },
            default: []
        }
    },
    computed: {
        address(): string {
            return this.wallet ? this.wallet.meta.addresses[parseInt(this.addressIndex)] : ''
        }
    }
})
</script>
