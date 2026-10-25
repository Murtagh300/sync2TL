<template>
    <div class="fit column no-wrap">
        <div class="tab-head row items-center no-wrap q-px-md">
            <h1 class="bvm-display tab-title">{{$t('nft.label_nfts')}}</h1>
            <q-space />
            <q-btn
                flat
                round
                icon="o_visibility"
                :to="{ name: 'watchlist' }"
                :aria-label="$t('watchlist.title')"
            />
        </div>
        <page-content
            class="col"
            size="lg"
        >
            <template v-if="wallet && supported">
                <div
                    v-if="wallet.meta.addresses.length > 1"
                    class="addresses row no-wrap q-px-md q-pb-sm"
                >
                    <button
                        v-for="(a, i) in wallet.meta.addresses"
                        :key="a"
                        type="button"
                        class="addr-chip row no-wrap items-center"
                        :class="{ 'addr-chip--active': i === index }"
                        @click="index = i"
                    >
                        <address-avatar
                            :addr="a"
                            size="18px"
                        />
                        <span class="q-ml-xs">#{{i + 1}}</span>
                    </button>
                </div>
                <q-pull-to-refresh
                    color="primary"
                    bg-color="dark"
                    @refresh="refresh"
                >
                <nft-grid
                    ref="grid"
                    :key="wallet.id + ':' + index"
                    :address="wallet.meta.addresses[index] || ''"
                    :wallet-id="String(wallet.id)"
                    :address-index="String(index)"
                    :gid="wallet.gid"
                />
                </q-pull-to-refresh>
            </template>
            <div
                v-else
                class="q-pa-lg text-center text-soft"
            >{{wallet ? $t('home.msg_mainnet_only') : $t('common.no_wallet')}}</div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageContent from 'components/PageContent.vue'
import AddressAvatar from 'components/AddressAvatar.vue'
import NftGrid from 'pages/Address/NftGrid.vue'
import { selectedWallet } from 'src/utils/selection'

// all NFTs of the selected wallet, one address at a time
export default defineComponent({
    components: { PageContent, AddressAvatar, NftGrid },
    data: () => ({
        index: 0,
        // async computed (see src/shims-async-computed.d.ts)
        wallets: null as M.Wallet[] | null
    }),
    asyncComputed: {
        wallets(): Promise<M.Wallet[]> {
            return this.$svc.wallet.all()
        }
    },
    computed: {
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets)
        },
        supported(): boolean {
            return !!this.wallet && this.$svc.bvm.supports(this.wallet.gid)
        }
    },
    watch: {
        wallet() { this.index = 0 }
    },
    methods: {
        refresh(done: () => void) {
            const grid = this.$refs.grid as { reload?: () => Promise<void> } | undefined
            void (grid?.reload?.() || Promise.resolve()).finally(done)
        }
    }
})
</script>
<style lang="sass" scoped>
.addresses
  gap: 8px
  overflow-x: auto
  scrollbar-width: none

.addr-chip
  flex: none
  padding: 5px 10px 5px 6px
  border-radius: 999px
  border: 1px solid $hairline-2
  background: rgba(255, 255, 255, 0.03)
  color: $text-soft
  font: inherit
  font-size: 13px
  font-weight: 700
  cursor: pointer

.addr-chip--active
  border-color: var(--q-primary)
  color: var(--q-primary)
</style>
