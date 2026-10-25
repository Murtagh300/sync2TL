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
                <div class="row items-center no-wrap q-px-md q-pt-sm">
                    <q-tabs
                        v-model="tab"
                        dense
                        no-caps
                        inline-label
                        align="left"
                        active-color="primary"
                        indicator-color="primary"
                        class="address-tabs"
                    >
                        <q-tab
                            name="tokens"
                            :label="$t('address.label_assets')"
                        />
                        <q-tab
                            v-if="nftSupported"
                            name="nfts"
                            :label="nftTotal ? `${$t('nft.label_nfts')} ${nftTotal}` : $t('nft.label_nfts')"
                        />
                    </q-tabs>
                    <q-btn
                        v-show="tab === 'tokens'"
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
            <page-content
                v-show="tab === 'tokens'"
                class="col"
            >
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
            <page-content
                v-if="nftSupported"
                v-show="tab === 'nfts'"
                class="col"
                size="lg"
            >
                <nft-grid
                    :address="address"
                    :wallet-id="walletId"
                    :address-index="addressIndex"
                    @total="nftTotal = $event"
                />
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
import NftGrid from './NftGrid.vue'
import { visibleTokens } from 'src/utils/tokens'

export default defineComponent({
    components: {
        TokenItem,
        HeadItem,
        AsyncResolve,
        PageToolbar,
        PageContent,
        NftGrid
    },
    props: {
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true }
    },
    data: () => ({
        tab: 'tokens' as 'tokens' | 'nfts',
        nftTotal: 0,
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
                return visibleTokens(this.$svc, wallet.gid, this.address)
            },
            default: []
        }
    },
    computed: {
        nftSupported(): boolean {
            return !!this.wallet && this.$svc.bvm.supports(this.wallet.gid)
        },
        address(): string {
            return this.wallet ? this.wallet.meta.addresses[parseInt(this.addressIndex)] : ''
        }
    }
})
</script>
<style lang="sass" scoped>
.address-tabs
  font-weight: 800
  :deep(.q-tab)
    padding: 0 12px 0 0
    min-height: 40px
  :deep(.q-tab__label)
    font-size: 15px
    font-weight: 800
</style>
