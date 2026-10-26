<template>
    <div class="column fit no-wrap home-root">
        <div
            v-if="prefs.homeBackground"
            class="home-backdrop"
            :style="{ backgroundImage: `url('${prefs.homeBackground}')` }"
        />
        <!-- ensure wallets is loaded -->
        <template v-if="wallets">
            <!-- the header: which wallet, search and the wallet's options -->
            <div class="home-head row no-wrap items-center q-px-sm">
                <wallet-switcher
                    :wallet="wallet"
                    :wallets="wallets"
                    :all="all"
                    @select="onSelectWallet($event)"
                />
                <q-space />
                <q-btn
                    flat
                    round
                    icon="o_notifications"
                    :aria-label="$t('notifications.title')"
                    @click="$router.push({ name: 'notifications' })"
                >
                    <q-badge
                        v-if="unread"
                        floating
                        rounded
                        color="primary"
                        text-color="dark"
                    >{{unread > 9 ? '9+' : unread}}</q-badge>
                </q-btn>
                <q-btn
                    v-if="nodeHealth.status === 'slow' || nodeHealth.status === 'down'"
                    flat
                    round
                    icon="o_cell_tower"
                    :color="nodeHealth.status === 'down' ? 'negative' : 'warning'"
                    :aria-label="$t(nodeHealth.status === 'down' ? 'nodeHealth.down' : 'nodeHealth.slow', { ms: nodeHealth.ms })"
                    @click="$router.push({ name: 'nodes-setting' })"
                >
                    <q-tooltip>{{$t(nodeHealth.status === 'down' ? 'nodeHealth.down' : 'nodeHealth.slow', { ms: nodeHealth.ms })}}</q-tooltip>
                </q-btn>
                <q-btn
                    flat
                    round
                    icon="o_search"
                    :aria-label="$t('search.title')"
                    @click="$router.push({ name: 'search' })"
                />
                <q-btn
                    flat
                    round
                    icon="o_lock"
                    :aria-label="$t('lock.action_now')"
                    @click="lockNow()"
                >
                    <q-tooltip>{{$t('lock.action_now')}}</q-tooltip>
                </q-btn>
                <q-btn
                    :aria-label="$t('a11y.more')"
                    v-if="wallet"
                    flat
                    round
                    icon="more_horiz"
                >
                    <option-menu :wallet="wallet" />
                </q-btn>
            </div>
            <pull-refresh
                class="col home-scroll overflow-auto"
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
                        <!-- the blocks in the user's order (WidgetsDialog) -->
                        <template
                            v-for="wd in shownWidgets"
                            :key="wd.key"
                        >
                            <price-ticker
                                v-if="wd.key === 'ticker'"
                                :wallet="wallet"
                                class="q-mb-md"
                            />
                            <template v-else-if="wd.key === 'portfolio'">
                                <portfolio-card
                                    ref="portfolio"
                                    :key="all ? 'all' : wallet.id"
                                    :wallet="wallet"
                                    :wallets="all ? wallets : [wallet]"
                                    :scope="all ? 'all' : String(wallet.id)"
                                    class="cursor-pointer"
                                    @click="$router.push({ name: 'portfolio' })"
                                />
                                <balance-pulse
                                    :wallet-id="wallet.id"
                                    @changed="onBalanceChanged()"
                                />
                            </template>
                            <quick-actions
                                v-else-if="wd.key === 'actions'"
                                :wallet="wallet"
                                class="q-mt-lg"
                            />
                            <template v-else-if="wd.key === 'addresses'">
                                <template
                                    v-for="w in (all ? wallets : [wallet])"
                                    :key="'list-' + w.id"
                                >
                                    <div class="bvm-label q-mt-xl q-mb-xs">{{all ? w.meta.name : $t('home.label_addresses', { n: w.meta.addresses.length })}}</div>
                                    <address-card-list
                                        :wallet="w"
                                        class="address-list"
                                    />
                                </template>
                            </template>
                            <home-widgets
                                v-else
                                :key="wd.key + (all ? 'all' : wallet.id)"
                                :kind="wd.key"
                                :wallet="wallet"
                                :wallets="all ? wallets : [wallet]"
                            />
                        </template>
                        <div class="text-center q-mt-xl">
                            <q-btn
                                flat
                                no-caps
                                icon="o_dashboard_customize"
                                class="text-muted"
                                :label="$t('widgets.title')"
                                @click="editWidgets()"
                            />
                        </div>
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
            </pull-refresh>
            <home-tour v-if="wallet" />
        </template>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PullRefresh from 'components/PullRefresh.vue'
import PriceTicker from './PriceTicker.vue'
import { lockNow } from 'src/utils/lock'
import { nodeHealth } from 'src/utils/node-health'
import BackupTip from './BackupTip.vue'
import UpgradeTip from './UpgradeTip.vue'
import AddressCardList from './AddressCardList.vue'
import OptionMenu from './OptionMenu.vue'
import WalletSwitcher from './WalletSwitcher.vue'
import PortfolioCard from './PortfolioCard.vue'
import QuickActions from './QuickActions.vue'
import BalancePulse from './BalancePulse.vue'
import HomeWidgets from './HomeWidgets.vue'
import HomeTour from './HomeTour.vue'
import WidgetsDialog from './WidgetsDialog.vue'
import { homeWidgets, type Widget } from './widgets'
import { prefs } from 'src/utils/prefs'
import { unreadCount } from 'src/utils/notifications'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { haptic } from 'src/utils/prefs'

export default defineComponent({
    components: { PullRefresh, PriceTicker, BackupTip, UpgradeTip, AddressCardList, OptionMenu, WalletSwitcher, PortfolioCard, QuickActions, BalancePulse, HomeWidgets, HomeTour },
    data: () => {
        return {
            nodeHealth,
            selection,
            prefs,
            // async computed (see src/shims-async-computed.d.ts)
            wallets: null as M.Wallet[] | null
        }
    },
    computed: {
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets)
        },
        all(): boolean {
            return selection.walletId === ALL_WALLETS && (this.wallets?.length || 0) > 1
        },
        shownWidgets(): Widget[] {
            return homeWidgets.list.filter(w => w.on)
        },
        unread(): number {
            return unreadCount.value
        }
    },
    asyncComputed: {
        wallets(): Promise<M.Wallet[] | null> {
            return this.$svc.wallet.all()
        }
    },
    watch: {
        wallets(newVal: M.Wallet[] | null, oldVal: M.Wallet[] | null) {
            if (newVal && newVal.length > 0 && selection.walletId !== ALL_WALLETS && !newVal.find(w => w.id === selection.walletId)) {
                // none selected, select the first one
                selection.walletId = newVal[0]!.id
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
        lockNow,
        onSelectWallet(id: number) {
            selection.walletId = id
            haptic()
        },
        editWidgets() {
            this.$dialog({ component: WidgetsDialog }).catch(() => { })
        },
        onBalanceChanged() {
            // the chain needs a moment to serve the new balance
            setTimeout(() => (this.$refs.portfolio as { refresh?: () => void } | undefined)?.refresh?.(), 3000)
        },
        refresh(done: () => void) {
            (this.$refs.portfolio as { refresh?: () => void } | undefined)?.refresh?.()
            void this.$asyncComputed.wallets?.update()
            setTimeout(done, 600)
        }
    }
})
</script>
<style lang="sass" scoped>
.home-root
  position: relative
  > *:not(.home-backdrop)
    position: relative
    z-index: 1

// the chosen NFT, large and quiet behind the total
.home-backdrop
  position: absolute
  top: 0
  left: 0
  right: 0
  height: 420px
  z-index: 0
  background-size: cover
  background-position: center
  filter: blur(2px) saturate(1.1)
  opacity: 0.35
  mask-image: linear-gradient(#000 30%, transparent)
  pointer-events: none

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
