<template>
    <div class="fit column no-wrap">
        <div class="tab-head row items-center no-wrap q-px-md">
            <h1 class="bvm-display tab-title col">{{$t('tabs.more')}}</h1>
            <q-btn
                flat
                round
                icon="o_settings"
                :aria-label="$t('settings.title')"
                :to="{ name: 'settings' }"
            />
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
            <!-- on a computer: the desktop app; on a phone: install as an app (PWA); unless it already is one -->
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
                    <div class="text-weight-bold">{{$t(computer ? 'install.title_desktop' : 'install.title')}}</div>
                    <div class="text-muted install-hint">{{$t(computer ? 'install.msg_desktop' : 'install.msg')}}</div>
                    <q-btn
                        v-if="computer"
                        flat
                        dense
                        no-caps
                        size="sm"
                        color="primary"
                        class="q-mt-xs q-px-none"
                        :label="$t('install.action_web_app')"
                        @click="installApp()"
                    />
                </div>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    :label="$t(computer ? 'install.action_download' : 'install.action')"
                    @click="computer ? openURL(downloadURL) : installApp()"
                />
            </div>
            <q-input
                v-model="query"
                dense
                outlined
                clearable
                class="q-mb-lg"
                :placeholder="$t('more.placeholder_search')"
                :aria-label="$t('more.placeholder_search')"
            >
                <template #prepend>
                    <q-icon name="o_search" />
                </template>
            </q-input>
            <template v-if="!query">
                <div class="bvm-label q-mb-sm q-ml-xs">{{$t('dappsGrid.title')}}</div>
                <dapps-grid class="q-mb-lg" />
            </template>
            <template
                v-for="g in shownGroups"
                :key="g.title"
            >
                <div class="bvm-label q-mb-sm q-ml-xs">{{g.title}}</div>
                <q-list
                    role="group"
                    class="bvm-list q-mb-lg"
                >
                    <more-item
                        v-for="it in g.items"
                        :key="it.title"
                        :icon="it.icon"
                        :title="it.title"
                        :to="it.to"
                        @click="it.click?.()"
                    />
                </q-list>
            </template>
            <div
                v-if="query && !shownGroups.length"
                class="text-muted text-center q-py-lg"
            >{{$t('more.msg_no_match')}}</div>
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
import BuyVetDialog from 'pages/Address/BuyVetDialog.vue'
import { featureOn, routeFeature } from 'src/utils/remote-config'
import WhatsNewDialog from 'components/WhatsNewDialog.vue'
import { install, installHelp, promptInstall } from 'src/utils/install'
import { releases } from 'src/changelog'
import { DESKTOP_DOWNLOAD } from 'src/utils/desktop'
import type { RouteLocationRaw } from 'vue-router'

type Item = { icon: string, title: string, to?: RouteLocationRaw, click?: () => void }
type Group = { title: string, items: Item[] }

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
        downloadURL: DESKTOP_DOWNLOAD,
        query: '' as string | null,
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
        /** a PC or Mac: the desktop app is the one to install there */
        computer(): boolean {
            return !this.$q.platform.is.mobile
        },
        /** the menu in groups, as found under their titles */
        groups(): Group[] {
            const t = (k: string) => this.$t(k).toString()
            const w = this.wallet
            const approvals: Item[] = w
                ? [{ icon: 'o_key', title: t('approvals.title'), to: { name: 'approvals', params: { walletId: String(w.id), addressIndex: '0' } } }]
                : []
            return [
                {
                    title: 'BlackVeMarket',
                    items: [
                        { icon: 'o_visibility', title: t('watchlist.title'), to: { name: 'watchlist' } },
                        { icon: 'o_rocket_launch', title: t('launchpad.title'), to: { name: 'launchpad' } },
                        { icon: 'o_sell', title: t('listings.title'), to: { name: 'listings' } },
                        { icon: 'o_local_offer', title: t('offerInbox.title'), to: { name: 'offers' } },
                        { icon: 'o_storefront', title: t('more.open_market'), click: () => openURL(marketURL) }
                    ]
                },
                {
                    title: t('more.label_money'),
                    items: [
                        { icon: 'o_add_card', title: t('buyVet.title'), click: () => this.buyVet() },
                        { icon: 'o_request_quote', title: t('payments.title'), to: { name: 'payments' } },
                        { icon: 'o_groups', title: t('payout.title'), to: { name: 'payout' } },
                        { icon: 'o_hub', title: t('stargate.title'), to: { name: 'stargate' } },
                        { icon: 'o_eco', title: t('vebetter.title'), to: { name: 'vebetter' } },
                        { icon: 'o_explore', title: t('discover.title'), to: { name: 'discover' } },
                        { icon: 'o_water_drop', title: t('liquidity.title'), to: { name: 'liquidity' } },
                        { icon: 'o_cleaning_services', title: t('dust.title'), to: { name: 'dust' } },
                        { icon: 'o_call_merge', title: t('consolidate.title'), to: { name: 'consolidate' } }
                    ]
                },
                {
                    title: t('more.label_insight'),
                    items: [
                        { icon: 'o_insights', title: t('overview.title'), to: { name: 'overview' } },
                        { icon: 'o_query_stats', title: t('pnl.title'), to: { name: 'pnl' } }
                    ]
                },
                {
                    title: t('more.label_security'),
                    items: [
                        { icon: 'o_shield', title: t('security.title'), to: { name: 'security' } },
                        ...approvals,
                        { icon: 'o_apps', title: t('dapps.title'), to: { name: 'dapps' } },
                        { icon: 'o_link', title: t('wc.title'), to: { name: 'walletconnect' } },
                        { icon: 'o_contacts', title: t('contacts.title'), to: { name: 'contacts' } },
                        { icon: 'o_family_restroom', title: t('emergency.title'), to: { name: 'emergency' } }
                    ]
                },
                {
                    title: t('more.label_app'),
                    items: [
                        { icon: 'o_search', title: t('search.title'), to: { name: 'search' } },
                        { icon: 'o_new_releases', title: t('whatsNew.title'), click: () => this.whatsNew() },
                        { icon: 'o_school', title: t('tour.action_again'), click: () => this.replayTour() },
                        { icon: 'o_settings', title: t('settings.title'), to: { name: 'settings' } }
                    ]
                }
            ]
        },
        /** the groups with what matches the search */
        shownGroups(): Group[] {
            const q = (this.query || '').trim().toLowerCase()
            if (!q) return this.groups
            return this.groups
                .map(g => ({ ...g, items: g.items.filter(i => i.title.toLowerCase().includes(q)) }))
                .filter(g => g.items.length)
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
        /** card, iDEAL or an exchange, to the selected wallet's first address */
        buyVet() {
            const w = this.wallet
            const address = w?.meta.addresses[0]
            if (!address) return
            this.$dialog({ component: BuyVetDialog, address }).catch(() => { })
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
