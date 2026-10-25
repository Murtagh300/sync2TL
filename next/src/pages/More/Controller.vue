<template>
    <div class="fit column no-wrap">
        <div class="tab-head row items-center no-wrap q-px-md">
            <h1 class="bvm-display tab-title">{{$t('tabs.more')}}</h1>
        </div>
        <page-content
            class="col"
            padding
        >
            <div class="bvm-label q-mb-sm q-ml-xs">BlackVeMarket</div>
            <q-list class="bvm-list q-mb-lg">
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
            <q-list class="bvm-list q-mb-lg">
                <more-item
                    icon="o_shield"
                    :title="$t('security.title')"
                    :to="{ name: 'security' }"
                />
                <more-item
                    icon="o_apps"
                    :title="$t('dapps.title')"
                    :to="{ name: 'dapps' }"
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
import { marketURL } from 'boot/services/bvm'
import { openURL } from 'src/utils/open-url'
import { selectedWallet } from 'src/utils/selection'

// a row of the menu
const MoreItem = defineComponent({
    props: { icon: String, title: String },
    setup(props, { attrs }) {
        return () => h(QItem, { clickable: true, ...attrs }, () => [
            h(QItemSection, { avatar: true }, () => h(QAvatar, { icon: props.icon })),
            h(QItemSection, () => props.title),
            h(QItemSection, { side: true }, () => h(QIcon, { name: 'chevron_right', class: 'text-muted' }))
        ])
    }
})

// everything that isn't a tab of its own
export default defineComponent({
    components: { PageContent, MoreItem },
    data: () => ({
        marketURL,
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
        openURL
    }
})
</script>
<style lang="sass" scoped>
.version
  font-size: 12px
</style>
