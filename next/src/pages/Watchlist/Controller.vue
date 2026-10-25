<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('watchlist.title')">
            <q-btn
                flat
                round
                icon="o_refresh"
                :disable="loading"
                @click="loadFeed()"
            />
        </page-toolbar>
        <page-content
            class="col"
            size="md"
        >
            <q-tabs
                v-model="tab"
                dense
                no-caps
                align="left"
                active-color="primary"
                indicator-color="primary"
                class="watch-tabs q-px-md"
            >
                <q-tab
                    name="feed"
                    :label="$t('watchlist.tab_feed')"
                />
                <q-tab
                    name="alerts"
                    :label="alerts.length ? `${$t('alerts.title')} ${alerts.length}` : $t('alerts.title')"
                />
            </q-tabs>

            <!-- feed -->
            <div
                v-show="tab === 'feed'"
                class="q-pa-md"
            >
                <div class="row q-gutter-sm q-mb-md">
                    <div
                        v-for="slug in list.collections"
                        :key="slug"
                        class="chip row no-wrap items-center"
                    >
                        <q-icon
                            name="o_collections"
                            size="15px"
                        />
                        <span class="ellipsis">{{collectionName(slug)}}</span>
                        <q-btn
                            flat
                            round
                            dense
                            size="xs"
                            icon="close"
                            @click="unwatchCollection(slug)"
                        />
                    </div>
                    <div
                        v-for="w in list.wallets"
                        :key="w"
                        class="chip row no-wrap items-center"
                    >
                        <q-icon
                            name="o_account_balance_wallet"
                            size="15px"
                        />
                        <address-label :addr="w" />
                        <q-btn
                            flat
                            round
                            dense
                            size="xs"
                            icon="close"
                            @click="unwatchWallet(w)"
                        />
                    </div>
                    <button
                        type="button"
                        class="chip chip--add"
                        @click="watchCollection()"
                    >+ {{$t('watchlist.action_collection')}}</button>
                    <button
                        type="button"
                        class="chip chip--add"
                        @click="watchWallet()"
                    >+ {{$t('watchlist.action_wallet')}}</button>
                </div>

                <div
                    v-if="loading && !feed.length"
                    class="row justify-center q-py-lg"
                >
                    <q-spinner-dots size="28px" />
                </div>
                <div
                    v-else-if="!feed.length"
                    class="bvm-tile q-pa-lg text-center text-soft"
                >{{list.collections.length || list.wallets.length ? $t('watchlist.msg_quiet') : $t('watchlist.msg_empty')}}</div>
                <q-list
                    v-else
                    class="bvm-list"
                >
                    <q-item
                        v-for="item in feed"
                        :key="item.id"
                        clickable
                        @click="openURL($svc.bvm.nftPage(item.contract, item.tokenId))"
                    >
                        <q-item-section avatar>
                            <q-avatar rounded>
                                <img
                                    :src="item.image"
                                    loading="lazy"
                                >
                            </q-avatar>
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label lines="1">{{item.name}}</q-item-label>
                            <q-item-label
                                caption
                                lines="1"
                            >{{item.collection}} · {{ago(item.time)}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <div
                                class="kind"
                                :class="`kind--${item.kind}`"
                            >{{$t(`watchlist.kind_${item.kind}`)}}</div>
                            <div class="bvm-amount feed-price">{{item.price}}</div>
                        </q-item-section>
                    </q-item>
                </q-list>
            </div>

            <!-- alerts -->
            <div
                v-show="tab === 'alerts'"
                class="q-pa-md"
            >
                <p class="text-soft">{{$t('alerts.msg_intro')}}</p>
                <q-btn
                    v-if="canAskPermission"
                    outline
                    no-caps
                    color="primary"
                    icon="o_notifications"
                    class="full-width q-mb-md"
                    :label="$t('alerts.action_allow_notifications')"
                    @click="askPermission()"
                />
                <q-list
                    v-if="alerts.length"
                    class="bvm-list q-mb-md"
                >
                    <q-item
                        v-for="a in alerts"
                        :key="a.id"
                    >
                        <q-item-section avatar>
                            <q-avatar :icon="a.kind === 'below' ? 'o_trending_down' : 'o_trending_up'" />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label lines="1">{{a.name}}</q-item-label>
                            <q-item-label caption>{{$t(a.kind === 'below' ? 'alerts.label_rule_below' : 'alerts.label_rule_above', { value: `${a.value} ${a.currency}` })}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-btn
                                flat
                                round
                                dense
                                icon="o_delete"
                                @click="removeAlert(a)"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    icon="add"
                    class="full-width"
                    :label="$t('alerts.title_add')"
                    @click="addAlert()"
                />
                <div class="bvm-tile q-pa-md q-mt-md row no-wrap items-center">
                    <q-icon
                        name="o_local_offer"
                        size="20px"
                        color="primary"
                    />
                    <div class="q-ml-md text-soft">{{$t('alerts.msg_offers_always')}}</div>
                </div>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address } from 'thor-devkit'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import PromptDialog, { type PromptOptions } from 'pages/Index/PromptDialog.vue'
import CollectionPicker from './CollectionPicker.vue'
import AlertDialog from './AlertDialog.vue'
import { collectionBySlug, emptyWatchlist, type AlertRule, type Watchlist } from 'src/utils/alerts'
import { isVetName, resolveVetName } from 'src/utils/names'
import { openURL } from 'src/utils/open-url'
import { formatDate } from 'src/utils/format'
import type { BVM } from 'boot/services/bvm'

// collections and wallets to follow on BlackVeMarket, and price alerts
export default defineComponent({
    components: { PageToolbar, PageContent, AddressLabel },
    data: () => ({
        tab: 'feed' as 'feed' | 'alerts',
        list: emptyWatchlist(),
        alerts: [] as AlertRule[],
        collections: {} as Record<string, BVM.Collection>,
        feed: [] as BVM.FeedItem[],
        loading: false,
        permission: typeof Notification === 'undefined' ? 'denied' : Notification.permission
    }),
    computed: {
        canAskPermission(): boolean {
            return this.permission === 'default'
        }
    },
    async created() {
        const [list, alerts] = await Promise.all([
            this.$svc.config.getJSON<Watchlist>('watchlist', emptyWatchlist()),
            this.$svc.config.getJSON<AlertRule[]>('alerts', [])
        ])
        this.list = list
        this.alerts = alerts
        this.$svc.bvm.collections().then(c => { this.collections = c }).catch(() => { })
        void this.loadFeed()
    },
    methods: {
        openURL,
        ago(time: number) {
            return time ? formatDate(time, { relative: true }) : ''
        },
        collectionName(slug: string) {
            return collectionBySlug(this.collections, slug)?.name || slug
        },
        async loadFeed() {
            const { collections, wallets } = this.list
            if (!collections.length && !wallets.length) {
                this.feed = []
                return
            }
            this.loading = true
            try {
                const parts = await Promise.all([
                    ...collections.map(slug => this.$svc.bvm.activity(slug, 10).catch(() => [] as BVM.FeedItem[])),
                    ...wallets.map(w => this.$svc.bvm.listings(w, 10)
                        .then(list => list.map<BVM.FeedItem>(n => ({
                            kind: 'listing',
                            id: `wallet:${n.contract}:${n.tokenId}`,
                            name: n.name,
                            image: n.image,
                            contract: n.contract,
                            tokenId: n.tokenId,
                            collection: n.collection,
                            collectionSlug: n.collectionSlug,
                            price: n.displayPrice ? `${n.displayPrice} ${n.currency || ''}` : '',
                            time: 0
                        })))
                        .catch(() => [] as BVM.FeedItem[]))
                ])
                const seen = new Set<string>()
                this.feed = parts.flat()
                    .filter(i => !seen.has(i.id) && !!seen.add(i.id))
                    .sort((a, b) => b.time - a.time)
                    .slice(0, 60)
            } finally {
                this.loading = false
            }
        },
        async save() {
            await this.$svc.config.setJSON('watchlist', this.list)
            void this.loadFeed()
        },
        async watchCollection() {
            try {
                const c = await this.$dialog<BVM.Collection>({ component: CollectionPicker, exclude: this.list.collections })
                this.list = { ...this.list, collections: [...this.list.collections, c.slug] }
                await this.save()
            } catch { }
        },
        async unwatchCollection(slug: string) {
            this.list = { ...this.list, collections: this.list.collections.filter(s => s !== slug) }
            await this.save()
        },
        async watchWallet() {
            const opts: PromptOptions = {
                title: this.$t('watchlist.action_wallet'),
                message: this.$t('contacts.label_address'),
                model: '',
                action: { label: this.$t('common.add'), color: 'primary' },
                validate: (input: string) => {
                    const v = input.trim()
                    return isVetName(v) || address.test(v) ? '' : this.$t('send.msg_invalid_address')
                }
            }
            try {
                let w = (await this.$dialog<string>({ component: PromptDialog, opts })).trim()
                if (isVetName(w)) {
                    const resolved = await resolveVetName(w)
                    if (!resolved) {
                        this.$q.notify(this.$t('send.msg_vet_not_found', { name: w }))
                        return
                    }
                    w = resolved
                }
                w = w.toLowerCase()
                if (!this.list.wallets.includes(w)) {
                    this.list = { ...this.list, wallets: [...this.list.wallets, w] }
                    await this.save()
                }
            } catch { }
        },
        async unwatchWallet(w: string) {
            this.list = { ...this.list, wallets: this.list.wallets.filter(x => x !== w) }
            await this.save()
        },
        async addAlert() {
            try {
                const c = await this.$dialog<BVM.Collection>({ component: CollectionPicker })
                const rule = await this.$dialog<AlertRule>({ component: AlertDialog, collection: c })
                this.alerts = [...this.alerts, rule]
                await this.$svc.config.setJSON('alerts', this.alerts)
                if (this.canAskPermission) {
                    void this.askPermission()
                }
            } catch { }
        },
        async removeAlert(rule: AlertRule) {
            this.alerts = this.alerts.filter(a => a !== rule)
            await this.$svc.config.setJSON('alerts', this.alerts)
        },
        async askPermission() {
            try {
                this.permission = await Notification.requestPermission()
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.watch-tabs
  :deep(.q-tab__label)
    font-size: 15px
    font-weight: 800

.chip
  max-width: 220px
  gap: 6px
  padding: 4px 6px 4px 10px
  border-radius: 999px
  border: 1px solid $hairline-2
  background: rgba(255, 255, 255, 0.03)
  color: $text-soft
  font: inherit
  font-size: 13px
  font-weight: 700

.chip--add
  padding: 6px 12px
  border-style: dashed
  color: $primary
  cursor: pointer

.kind
  font-size: 11px
  font-weight: 800
  text-align: right

.kind--listing
  color: $text-soft

.kind--sale
  color: $primary

.kind--offer
  color: $warning

.feed-price
  font-size: 14px
  color: $text
</style>
