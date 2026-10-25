<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="summary ? summary.collection.name : $t('search.label_collections')">
            <q-btn
                flat
                round
                icon="o_open_in_new"
                @click="openURL($svc.bvm.collectionPage(slug))"
            />
        </page-toolbar>
        <page-content
            class="col"
            size="lg"
        >
            <div
                v-if="summary"
                class="q-pa-md"
            >
                <div class="row no-wrap items-center">
                    <img
                        :src="summary.collection.coverImage"
                        alt=""
                        class="cover"
                    >
                    <div
                        class="q-ml-md col"
                        style="min-width: 0"
                    >
                        <h1 class="bvm-display coll-title ellipsis">{{summary.collection.name}}</h1>
                        <div class="text-muted ellipsis">{{summary.collection.description}}</div>
                    </div>
                </div>
                <div class="stats q-mt-md">
                    <div class="bvm-tile stat">
                        <div class="text-muted">{{$t('market.label_floor')}}</div>
                        <div class="bvm-amount">{{summary.floor || '–'}}</div>
                    </div>
                    <div class="bvm-tile stat">
                        <div class="text-muted">{{$t('collection.label_listed')}}</div>
                        <div class="bvm-amount">{{summary.listedCount}}</div>
                    </div>
                    <div class="bvm-tile stat">
                        <div class="text-muted">{{$t('collection.label_owners')}}</div>
                        <div class="bvm-amount">{{summary.owners}}</div>
                    </div>
                    <div class="bvm-tile stat">
                        <div class="text-muted">{{$t('collection.label_volume')}}</div>
                        <div class="bvm-amount ellipsis">{{summary.volume.vetLabel || summary.volume.total}}</div>
                    </div>
                </div>
                <div class="row no-wrap q-gutter-x-sm q-mt-md">
                    <q-btn
                        class="col"
                        unelevated
                        no-caps
                        color="primary"
                        icon="o_local_offer"
                        :label="$t('offers.action_collection')"
                        @click="offerOnCollection()"
                    />
                    <q-btn
                        class="col"
                        outline
                        no-caps
                        color="primary"
                        :icon="watching ? 'visibility' : 'o_visibility'"
                        :label="watching ? $t('collection.action_watching') : $t('collection.action_watch')"
                        @click="toggleWatch()"
                    />
                </div>

                <!-- collection offers, yours can be withdrawn -->
                <template v-if="offers.length">
                    <div class="bvm-label q-mt-lg q-mb-sm">{{$t('collection.label_offers')}}</div>
                    <q-list class="bvm-list">
                        <q-item
                            v-for="o in offers"
                            :key="o.offerId || o.id"
                        >
                            <q-item-section>
                                <q-item-label class="bvm-amount">{{o.displayAmount}} {{o.currency}} × {{o.quantity}}</q-item-label>
                                <q-item-label caption>
                                    <address-label :addr="o.buyer" />
                                </q-item-label>
                            </q-item-section>
                            <q-item-section
                                v-if="isMine(o.buyer)"
                                side
                            >
                                <q-btn
                                    flat
                                    dense
                                    no-caps
                                    color="negative"
                                    :label="$t('offers.action_withdraw')"
                                    @click="withdrawCollectionOffer(o)"
                                />
                            </q-item-section>
                        </q-item>
                    </q-list>
                </template>

                <div class="bvm-label q-mt-lg q-mb-sm">{{$t('collection.label_for_sale')}}</div>
            </div>
            <div
                v-else
                class="q-pa-md"
            >
                <q-skeleton height="80px" />
                <q-skeleton
                    class="q-mt-md"
                    height="70px"
                />
            </div>

            <!-- listed NFTs, cheapest first -->
            <div
                v-if="items.length"
                class="grid"
            >
                <div
                    v-for="nft in items"
                    :key="nft.tokenId"
                    class="nft bvm-tile"
                >
                    <router-link
                        :to="nftRoute(nft)"
                        class="nft-link"
                    >
                        <q-img
                            :src="nft.image"
                            :ratio="1"
                        >
                            <div
                                v-if="nft.rank"
                                class="nft-rank"
                            >#{{nft.rank}}</div>
                        </q-img>
                        <div class="nft-body">
                            <div class="nft-name ellipsis">{{nft.name}}</div>
                            <div class="bvm-amount nft-price">{{nft.price}}</div>
                        </div>
                    </router-link>
                    <q-btn
                        unelevated
                        no-caps
                        dense
                        color="primary"
                        class="buy-btn"
                        :label="$t('collection.action_buy')"
                        @click="buy(nft)"
                    />
                </div>
            </div>
            <div
                v-else-if="!loading && summary"
                class="text-center text-soft q-pa-lg"
            >{{$t('collection.msg_none_listed')}}</div>
            <div
                v-if="hasMore"
                class="q-pa-md"
            >
                <q-btn
                    outline
                    no-caps
                    color="primary"
                    class="full-width"
                    :loading="loading"
                    :label="$t('nft.action_load_more')"
                    @click="load()"
                />
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent, markRaw } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import OfferDialog, { type OfferResult } from './OfferDialog.vue'
import { buyClauses, cancelCollectionOfferClauses, collectionOfferClauses } from 'src/utils/market'
import { emptyWatchlist, type Watchlist } from 'src/utils/alerts'
import { selectedWallet } from 'src/utils/selection'
import { openURL } from 'src/utils/open-url'
import { toWei } from 'src/utils/format'
import { genesises } from 'src/consts'
import type { BVM } from 'boot/services/bvm'
import type { RouteLocationRaw } from 'vue-router'

// a BlackVeMarket collection in the wallet: its numbers, what is for sale, offers
export default defineComponent({
    components: { PageToolbar, PageContent, AddressLabel },
    props: {
        slug: { type: String, required: true }
    },
    data: () => ({
        summary: null as BVM.CollectionSummary | null,
        items: [] as BVM.NFT[],
        offers: [] as BVM.CollectionOffer[],
        offset: 0,
        hasMore: false,
        loading: false,
        watching: false,
        wallets: [] as M.Wallet[]
    }),
    computed: {
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets.filter(w => w.gid === genesises.main.id))
        },
        mine(): string[] {
            return this.wallets.flatMap(w => w.meta.addresses.map(a => a.toLowerCase()))
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const list = await this.$svc.config.getJSON<Watchlist>('watchlist', emptyWatchlist())
        this.watching = list.collections.includes(this.slug)
        void this.load()
        this.$svc.bvm.collectionOffers(this.slug).then(r => { this.offers = r.offers || [] }).catch(() => { })
    },
    methods: {
        openURL,
        isMine(address: string) {
            return this.mine.includes((address || '').toLowerCase())
        },
        nftRoute(nft: BVM.NFT): RouteLocationRaw {
            return { name: 'nft', params: { walletId: String(this.wallet?.id ?? 0), addressIndex: '0', contract: nft.contract, tokenId: nft.tokenId } }
        },
        async load() {
            if (this.loading) return
            this.loading = true
            try {
                const r = await this.$svc.bvm.collection(this.slug, { offset: this.offset, limit: 30, status: 'listed', sort: 'price-low' })
                this.summary = r.summary
                this.items = [...this.items, ...r.items.filter(n => n.listed).map(n => markRaw(n))]
                this.offset = r.pagination.nextOffset
                this.hasMore = r.pagination.hasMore
            } catch {
                this.hasMore = false
            } finally {
                this.loading = false
            }
        },
        async toggleWatch() {
            const list = await this.$svc.config.getJSON<Watchlist>('watchlist', emptyWatchlist())
            const collections = this.watching ? list.collections.filter(s => s !== this.slug) : [...list.collections, this.slug]
            await this.$svc.config.setJSON('watchlist', { ...list, collections })
            this.watching = !this.watching
        },
        async buy(nft: BVM.NFT) {
            const comment = this.$t('collection.comment_buy', { nft: nft.name, price: nft.price })
            try {
                // the signer is chosen in the transaction dialog
                await this.$signTx(genesises.main.id, {
                    message: buyClauses(nft).map(c => ({ ...c, comment })),
                    options: { comment }
                })
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('collection.msg_bought'), image: nft.image }).catch(() => { })
                this.items = this.items.filter(n => n !== nft)
            } catch { }
        },
        async offerOnCollection() {
            const s = this.summary
            if (!s) return
            try {
                const r = await this.$dialog<OfferResult>({
                    component: OfferDialog,
                    title: this.$t('offers.action_collection'),
                    message: s.collection.name,
                    floor: s.floor,
                    collection: true
                })
                const comment = this.$t('offers.comment_collection', { n: r.quantity, collection: s.collection.name, price: `${r.price} ${r.symbol}` })
                await this.$signTx(genesises.main.id, {
                    message: collectionOfferClauses(s.collection.nftContract, toWei(r.price, 18), r.quantity, r.symbol, r.days).map(c => ({ ...c, comment })),
                    options: { comment }
                })
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('offers.msg_placed'), image: s.collection.coverImage }).catch(() => { })
            } catch { }
        },
        async withdrawCollectionOffer(o: BVM.CollectionOffer) {
            const comment = this.$t('offers.comment_withdraw')
            try {
                await this.$signTx(genesises.main.id, {
                    message: cancelCollectionOfferClauses(o.offerId || o.id).map(c => ({ ...c, comment })),
                    options: { signer: o.buyer, comment }
                })
                this.offers = this.offers.filter(x => x !== o)
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.cover
  width: 64px
  height: 64px
  flex: none
  border-radius: $radius
  object-fit: cover

.coll-title
  margin: 0
  font-size: 24px

.stats
  display: grid
  grid-template-columns: repeat(4, 1fr)
  gap: 8px

.stat
  padding: 8px 10px
  font-size: 12px
  .bvm-amount
    font-size: 15px
    color: $text

.grid
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))
  gap: 10px
  padding: 0 16px 16px

.nft
  position: relative
  overflow: hidden
  display: flex
  flex-direction: column

.nft-link
  color: inherit
  text-decoration: none

.nft-rank
  position: absolute
  top: 8px
  left: 8px
  padding: 2px 6px
  border-radius: 6px
  background: rgba(0, 0, 0, 0.6)
  font-size: 11px
  font-weight: 800

.nft-body
  padding: 8px 10px 4px

.nft-name
  font-weight: 800
  font-size: 13px

.nft-price
  font-size: 14px

.buy-btn
  margin: 4px 10px 10px
  border-radius: 8px
  font-weight: 800

@media (max-width: 420px)
  .stats
    grid-template-columns: repeat(2, 1fr)
</style>
