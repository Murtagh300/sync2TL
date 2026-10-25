<template>
    <div>
        <transition
            v-if="mounted"
            appear
            name="q-transition--fade"
        >
            <div
                v-if="initialized"
                class="no-wrap fit"
                :class="wide ? 'row' : 'column'"
            >
                <!-- wide screens: the tabs as a side bar, always there -->
                <tab-bar
                    v-if="wide"
                    vertical
                />
                <div class="column no-wrap col">
                    <offline-bar />
                    <div class="col relative-position">
                        <stacked-router-view class="fit" />
                        <tx-status-bar />
                    </div>
                    <tab-bar v-if="!wide && showTabs" />
                </div>
            </div>
            <wizard
                v-else
                class="fit"
                @done="initialized=true"
            />
        </transition>
        <template v-if="initialized">
            <activity-status-updater />
            <transfer-notifier
                v-for="gid in gids"
                :key="gid"
                :gid="gid"
            />
        </template>
        <disclaimer />
        <app-lock v-if="initialized" />
        <wallet-connect-host v-if="initialized" />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Wizard from 'pages/Wizard'
import StackedRouterView from 'components/StackedRouterView.vue'
import ActivityStatusUpdater from 'pages/ActivityStatusUpdater'
import TransferNotifier from 'pages/TransferNotifier.vue'
import { unique } from 'src/utils/array'
import Disclaimer from './Disclaimer'
import TabBar, { TAB_ROUTES } from 'components/TabBar.vue'
import TxStatusBar from 'components/TxStatusBar.vue'
import OfflineBar from 'components/OfflineBar.vue'
import AppLock from 'components/AppLock.vue'
import { WalletConnectHost } from 'pages/WalletConnect'
import { applyAccent, applyDisplay } from 'src/utils/prefs'
import { setupPrivacyClass, setupShake } from 'src/utils/shake'

export default defineComponent({
    name: 'Main',
    components: { Wizard, StackedRouterView, ActivityStatusUpdater, TransferNotifier, Disclaimer, TabBar, TxStatusBar, OfflineBar, AppLock, WalletConnectHost },
    data() {
        return {
            initialized: false,
            mounted: false,
            // async computed (see src/shims-async-computed.d.ts)
            gids: null as string[] | null
        }
    },
    computed: {
        wide(): boolean {
            return this.$q.screen.width >= 1024
        },
        showTabs(): boolean {
            return TAB_ROUTES.includes(String(this.$route.name || ''))
        }
    },
    asyncComputed: {
        async gids(): Promise<string[]> {
            const wallets = await this.$svc.wallet.all()
            return unique(wallets.map(w => w.gid))
        }
    },
    created() {
        applyAccent()
        applyDisplay()
        setupPrivacyClass()
        setupShake()
    },
    async mounted() {
        this.initialized = await this.$svc.config.getUserMasterKeyGlob().then(r => !!r)
        this.mounted = true
    }
})
</script>
