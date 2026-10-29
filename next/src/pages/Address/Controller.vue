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
                <div class="address-actions row no-wrap q-px-md q-pb-xs">
                    <q-btn
                        outline
                        no-caps
                        stack
                        color="primary"
                        icon="o_qr_code_2"
                        :label="$t('address.action_receive')"
                        @click="receive()"
                    />
                    <q-btn
                        v-if="nftSupported"
                        outline
                        no-caps
                        stack
                        color="primary"
                        icon="o_swap_vert"
                        :label="$t('swap.title')"
                        :to="{ name: 'swap', query: { wid: walletId, i: addressIndex } }"
                    />
                    <q-btn
                        outline
                        no-caps
                        stack
                        color="primary"
                        icon="o_key"
                        :label="$t('approvals.action_open')"
                        :to="{ name: 'approvals', params: { walletId, addressIndex } }"
                    />
                </div>
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
                        :aria-label="$t('a11y.options')"
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
                <q-list v-if="!tokenList.length">
                    <q-item
                        v-for="i in 4"
                        :key="i"
                    >
                        <q-item-section avatar>
                            <q-skeleton type="QAvatar" />
                        </q-item-section>
                        <q-item-section>
                            <q-skeleton
                                type="text"
                                width="40%"
                            />
                            <q-skeleton
                                type="text"
                                width="60%"
                            />
                        </q-item-section>
                        <q-item-section side>
                            <q-skeleton
                                type="text"
                                width="70px"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <q-list v-else>
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
                            :balance="data ?? $svc.bc(token.gid).cachedBalance(address, token)"
                            :stat="stats[(token.address || zero).toLowerCase()]"
                            :fx="fx"
                            :pinned="tokenPrefs.pinned.includes(token.symbol)"
                            :buy="isFeatured(token) && canSign(wallet)"
                            @pin="pin(token, $event)"
                            @hide="hide(token)"
                            @buy="$router.push(buyRoute(token.symbol, walletId, addressIndex))"
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
                    :gid="wallet.gid"
                    :signable="canSign(wallet)"
                    @total="nftTotal = $event"
                />
            </page-content>
        </template>
    </div>
</template>
<script lang="ts">
import { canSign } from 'src/utils/watch'
import { defineComponent } from 'vue'
import TokenItem from './TokenItem.vue'
import HeadItem from './HeadItem.vue'
import AsyncResolve from 'components/AsyncResolve'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import NftGrid from './NftGrid.vue'
import { buyRoute, isFeatured, visibleTokens, type TokenPrefs } from 'src/utils/tokens'
import ReceiveDialog from './ReceiveDialog.vue'
import type { Prices } from 'boot/services/prices'
import { prefs } from 'src/utils/prefs'
import type { Currency } from 'src/utils/fiat'

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
        tokenList: [] as M.TokenSpec[],
        stats: {} as Record<string, Prices.Stat>,
        fx: 1,
        zero: '0x0000000000000000000000000000000000000000',
        tokenPrefs: { pinned: [], hidden: [] } as TokenPrefs,
        prefs
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
            return this.wallet ? (this.wallet.meta.addresses[parseInt(this.addressIndex)] ?? '') : ''
        }
    },
    watch: {
        async tokenList(list: M.TokenSpec[]) {
            if (!this.nftSupported || !list.length) {
                return
            }
            this.stats = await this.$svc.prices.stats(list.map(t => t.address)).catch(() => ({}))
        },
        'prefs.currency': {
            async handler(c: Currency) {
                this.fx = await this.$svc.prices.fx(c)
            },
            immediate: true
        }
    },
    async created() {
        this.tokenPrefs = await this.$svc.config.getJSON<TokenPrefs>('token-prefs', { pinned: [], hidden: [] })
    },
    methods: {
        canSign,
        isFeatured,
        buyRoute,
        async saveTokenPrefs(p: TokenPrefs) {
            this.tokenPrefs = p
            await this.$svc.config.setJSON('token-prefs', p)
            void this.$asyncComputed.tokenList?.update()
        },
        pin(token: M.TokenSpec, on: boolean) {
            const pinned = this.tokenPrefs.pinned.filter(s => s !== token.symbol)
            void this.saveTokenPrefs({ ...this.tokenPrefs, pinned: on ? [...pinned, token.symbol] : pinned })
        },
        hide(token: M.TokenSpec) {
            void this.saveTokenPrefs({
                pinned: this.tokenPrefs.pinned.filter(s => s !== token.symbol),
                hidden: [...this.tokenPrefs.hidden.filter(s => s !== token.symbol), token.symbol]
            })
            this.$q.notify({
                message: this.$t('tokens.msg_hidden', { symbol: token.symbol }),
                actions: [{
                    label: this.$t('tokens.action_undo'),
                    color: 'primary',
                    handler: () => void this.saveTokenPrefs({ ...this.tokenPrefs, hidden: this.tokenPrefs.hidden.filter(s => s !== token.symbol) })
                }]
            })
        },
        receive() {
            this.$dialog({
                component: ReceiveDialog,
                address: this.address,
                symbols: this.tokenList.map(t => t.symbol)
            }).catch(() => { })
        }
    }
})
</script>
<style lang="sass" scoped>
.address-actions
  gap: 8px
  .q-btn
    flex: 1 1 0
    min-width: 0
    padding: 6px 4px
    border-radius: $radius
    font-weight: 700

.address-tabs
  font-weight: 800
  :deep(.q-tab)
    padding: 0 12px 0 0
    min-height: 40px
  :deep(.q-tab__label)
    font-size: 15px
    font-weight: 800
</style>
