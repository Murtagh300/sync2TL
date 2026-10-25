<template>
    <div class="column fit no-wrap">
        <!-- ensure wallets is loaded -->
        <template v-if="wallets">
            <!-- the header: which wallet, search and the wallet's options -->
            <div class="home-head row no-wrap items-center q-px-sm">
                <wallet-switcher
                    :wallet="wallet"
                    :wallets="wallets"
                    @select="onSelectWallet($event)"
                />
                <q-space />
                <q-btn
                    flat
                    round
                    icon="o_search"
                    :aria-label="$t('search.title')"
                    @click="$router.push({ name: 'search' })"
                />
                <q-btn
                    v-if="wallet"
                    flat
                    round
                    icon="more_horiz"
                >
                    <option-menu :wallet="wallet" />
                </q-btn>
            </div>
            <q-pull-to-refresh
                class="col home-scroll overflow-auto"
                color="primary"
                bg-color="dark"
                @refresh="refresh"
            >
                <div class="home-page q-mx-auto q-px-md q-pb-lg">
                    <!-- tips -->
                    <upgrade-tip v-if="$state.app.updateAvailable" />
                    <backup-tip
                        v-for="w in wallets"
                        :key="w.id"
                        @backup="$router.push({name: 'backup', params: {walletId: w.id.toString()}})"
                        v-show="w.id === wallet?.id && !w.meta.backedUp"
                    />
                    <template v-if="wallet">
                        <portfolio-card
                            ref="portfolio"
                            :key="wallet.id"
                            :wallet="wallet"
                        />
                        <quick-actions
                            :wallet="wallet"
                            class="q-mt-lg"
                        />
                        <div class="bvm-label q-mt-xl q-mb-xs">{{$t('home.label_addresses', { n: wallet.meta.addresses.length })}}</div>
                        <address-card-list
                            ref="list"
                            :key="'list-' + wallet.id"
                            :wallet="wallet"
                            class="address-list"
                        />
                    </template>
                    <div
                        v-else
                        class="home-empty text-center"
                    >
                        <p class="bvm-display text-h4 text-center q-mb-sm">{{$t('common.no_wallet')}}</p>
                        <p class="text-soft q-mb-lg">{{$t('home.msg_no_wallet')}}</p>
                        <q-btn
                            unelevated
                            color="primary"
                            size="lg"
                            no-caps
                            class="q-px-lg"
                            :label="$t('index.action_create')"
                            :to="{name: 'new-wallet'}"
                        />
                    </div>
                </div>
            </q-pull-to-refresh>
        </template>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import BackupTip from './BackupTip.vue'
import UpgradeTip from './UpgradeTip.vue'
import AddressCardList from './AddressCardList.vue'
import OptionMenu from './OptionMenu.vue'
import WalletSwitcher from './WalletSwitcher.vue'
import PortfolioCard from './PortfolioCard.vue'
import QuickActions from './QuickActions.vue'
import { selection, selectedWallet } from 'src/utils/selection'
import { haptic } from 'src/utils/prefs'

export default defineComponent({
    components: { BackupTip, UpgradeTip, AddressCardList, OptionMenu, WalletSwitcher, PortfolioCard, QuickActions },
    data: () => {
        return {
            selection,
            // async computed (see src/shims-async-computed.d.ts)
            wallets: null as M.Wallet[] | null
        }
    },
    computed: {
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets)
        }
    },
    asyncComputed: {
        wallets(): Promise<M.Wallet[] | null> {
            return this.$svc.wallet.all()
        }
    },
    watch: {
        wallets(newVal: M.Wallet[] | null, oldVal: M.Wallet[] | null) {
            if (newVal && newVal.length > 0 && !newVal.find(w => w.id === selection.walletId)) {
                // none selected, select the first one
                selection.walletId = newVal[0].id
                return
            }

            if (newVal && oldVal && newVal.length === oldVal.length + 1) {
                // new wallet created, find out and select it
                for (const { id } of newVal) {
                    if (!oldVal.find(w => w.id === id)) {
                        selection.walletId = id
                        break
                    }
                }
            }
        }
    },
    methods: {
        onSelectWallet(id: number) {
            selection.walletId = id
            haptic()
        },
        refresh(done: () => void) {
            (this.$refs.portfolio as { refresh?: () => void } | undefined)?.refresh?.()
            void this.$asyncComputed.wallets.update()
            setTimeout(done, 600)
        }
    }
})
</script>
<style lang="sass" scoped>
.home-head
  min-height: 60px
  padding-top: env(safe-area-inset-top)

.home-page
  max-width: 560px

.home-empty
  padding: 18vh 8px 0

// the cards sit in the page's own scroll
.address-list
  margin: 0 -8px
  overflow: visible !important
</style>
