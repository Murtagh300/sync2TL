<template>
    <div class="fit column no-wrap">
        <div class="tab-head row items-center no-wrap q-px-md">
            <h1 class="bvm-display tab-title">{{$t('tabs.more')}}</h1>
        </div>
        <page-content
            class="col"
            padding
        >
            <div
                v-if="$route.query.paused"
                class="paused-note q-mb-md"
                role="status"
            >
                <q-icon
                    name="o_pause_circle"
                    size="18px"
                    class="q-mr-sm"
                />{{$t('service.msg_paused')}}
            </div>
            <!-- install as an app (PC, Mac, phone), unless it already is one -->
            <div
                v-if="!install.installed"
                class="bvm-tile install-tile q-pa-md q-mb-lg row no-wrap items-center"
            >
                <q-icon
                    name="o_install_desktop"
                    size="28px"
                    color="primary"
                />
                <div class="col q-mx-md">
                    <div class="text-weight-bold">{{$t('install.title')}}</div>
                    <div class="text-muted install-hint">{{$t('install.msg')}}</div>
                </div>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    :label="$t('install.action')"
                    @click="installApp()"
                />
            </div>
            <div class="bvm-label q-mb-sm q-ml-xs">{{$t('dappsGrid.title')}}</div>
            <dapps-grid class="q-mb-lg" />
            <div class="bvm-label q-mb-sm q-ml-xs">BlackVeMarket</div>
            <q-list role="group" class="bvm-list q-mb-lg">
                <more-item
                    icon="o_visibility"
                    :title="$t('watchlist.title')"
                    :to="{ name: 'watchlist' }"
                />
                <more-item
                    icon="o_rocket_launch"
                    :title="$t('launchpad.title')"
                    :to="{ name: 'launchpad' }"
                />
                <more-item
                    icon="o_storefront"
                    :title="$t('more.open_market')"
                    @click="openURL(marketURL)"
                />
            </q-list>
            <div class="bvm-label q-mb-sm q-ml-xs">{{$t('more.label_wallet')}}</div>
            <q-list role="group" class="bvm-list q-mb-lg">
                <more-item
                    icon="o_shield"
                    :title="$t('security.title')"
                    :to="{ name: 'security' }"
                />
                <more-item
                    icon="o_family_restroom"
                    :title="$t('emergency.title')"
                    :to="{ name: 'emergency' }"
                />
                <more-item
                    icon="o_apps"
                    :title="$t('dapps.title')"
                    :to="{ name: 'dapps' }"
                />
                <more-item
                    icon="o_link"
                    :title="$t('wc.title')"
                    :to="{ name: 'walletconnect' }"
                />
                <more-item
                    icon="o_sell"
                    :title="$t('listings.title')"
                    :to="{ name: 'listings' }"
                />
                <more-item
                    icon="o_local_offer"
                    :title="$t('offerInbox.title')"
                    :to="{ name: 'offers' }"
                />
                <more-item
                    icon="o_hub"
                    :title="$t('stargate.title')"
                    :to="{ name: 'stargate' }"
                />
                <more-item
                    icon="o_eco"
                    :title="$t('vebetter.title')"
                    :to="{ name: 'vebetter' }"
                />
                <more-item
                    icon="o_water_drop"
                    :title="$t('liquidity.title')"
                    :to="{ name: 'liquidity' }"
                />
                <more-item
                    icon="o_request_quote"
                    :title="$t('payments.title')"
                    :to="{ name: 'payments' }"
                />
                <more-item
                    icon="o_query_stats"
                    :title="$t('pnl.title')"
                    :to="{ name: 'pnl' }"
                />
                <more-item
                    icon="o_insights"
                    :title="$t('overview.title')"
                    :to="{ name: 'overview' }"
                />
                <more-item
                    icon="o_cleaning_services"
                    :title="$t('dust.title')"
                    :to="{ name: 'dust' }"
                />
                <more-item
                    icon="o_call_merge"
                    :title="$t('consolidate.title')"
                    :to="{ name: 'consolidate' }"
                />
                <more-item
                    icon="o_groups"
                    :title="$t('payout.title')"
                    :to="{ name: 'payout' }"
                />
                <more-item
                    icon="o_contacts"
                    :title="$t('contacts.title')"
                    :to="{ name: 'contacts' }"
                />
                <more-item
                    v-if="wallet"
                    icon="o_key"
                    :title="$t('approvals.title')"
                    :to="{ name: 'approvals', params: { walletId: String(wallet.id), addressIndex: '0' } }"
                />
                <more-item
                    icon="o_search"
                    :title="$t('search.title')"
                    :to="{ name: 'search' }"
                />
                <more-item
                    icon="o_new_releases"
                    :title="$t('whatsNew.title')"
                    @click="whatsNew()"
                />
                <more-item
                    icon="o_school"
                    :title="$t('tour.action_again')"
                    @click="replayTour()"
                />
                <more-item
                    icon="o_settings"
                    :title="$t('settings.title')"
                    :to="{ name: 'settings' }"
                />
            </q-list>
            <div class="text-center text-muted version">BlackVault v{{version}} · {{build}}</div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent, h } from 'vue'
import { QItem, QItemSection, QIcon, QAvatar } from 'quasar'
import PageContent from 'components/PageContent.vue'
import DappsGrid from 'components/DappsGrid.vue'
import { marketURL } from 'boot/services/bvm'
import { openURL } from 'src/utils/open-url'
import { selectedWallet } from 'src/utils/selection'
import { featureOn, routeFeature } from 'src/utils/remote-config'
import WhatsNewDialog from 'components/WhatsNewDialog.vue'
import { install, installHelp, promptInstall } from 'src/utils/install'
import { releases } from 'src/changelog'

// a row of the menu
const MoreItem = defineComponent({
    props: { icon: String, title: String },
    setup(props, { attrs }) {
        // a feature the server paused isn't offered
        const feature = () => routeFeature[String((attrs.to as { name?: string } | undefined)?.name || '')]
        return () => {
            const f = feature()
            return f && !featureOn(f) ? null : item()
        }
        function item() {
            return h(QItem, { clickable: true, ...attrs }, () => [
            h(QItemSection, { avatar: true }, () => h(QAvatar, { icon: props.icon })),
            h(QItemSection, () => props.title),
            h(QItemSection, { side: true }, () => h(QIcon, { name: 'chevron_right', class: 'text-muted' }))
            ])
        }
    }
})

// everything that isn't a tab of its own
export default defineComponent({
    components: { PageContent, MoreItem, DappsGrid },
    data: () => ({
        marketURL,
        install,
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
        version(): string { return import.meta.env.APP_VERSION || '' },
        build(): string { return import.meta.env.APP_BUILD || '' }
    },
    methods: {
        openURL,
        async installApp() {
            // Chrome and Edge: their own install window
            if (this.install.prompt) {
                if (await promptInstall()) this.$q.notify(this.$t('install.msg_done'))
                return
            }
            // elsewhere: the steps for this browser
            this.$q.dialog({
                title: this.$t('install.title'),
                message: this.$t(`install.help_${installHelp().replace('-', '_')}`),
                style: 'white-space: pre-line',
                ok: { label: this.$t('common.ok'), color: 'primary', unelevated: true, noCaps: true }
            })
        },
        whatsNew() {
            const release = releases[0]
            if (release) this.$dialog({ component: WhatsNewDialog, release }).catch(() => { })
        },
        replayTour() {
            try {
                localStorage.removeItem('bv-tour-done')
            } catch { }
            void this.$router.replace({ name: 'index' })
        }
    }
})
</script>
<style lang="sass" scoped>
.version
  font-size: 12px

.install-tile
  border-color: color-mix(in srgb, var(--q-primary) 35%, transparent)

.install-hint
  font-size: 12px

.paused-note
  display: flex
  align-items: center
  padding: 10px 12px
  border-radius: 12px
  background: rgba(252, 211, 77, 0.10)
  color: $warning
  font-size: 13px
  font-weight: 700
</style>
