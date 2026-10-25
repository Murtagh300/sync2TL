<template>
    <div class="nft-grid-page">
        <!-- portfolio: what the NFTs are worth at their collection floors -->
        <div
            v-if="total && !collection"
            class="bvm-tile portfolio q-mx-md q-mb-md"
        >
            <div class="row no-wrap items-start">
                <div class="col">
                    <div class="text-muted portfolio-label">{{$t('nft.label_portfolio')}}</div>
                    <div
                        v-if="worth.length"
                        class="bvm-display portfolio-value"
                    >≈ {{worth.join(' + ')}}</div>
                    <div
                        v-else
                        class="text-muted"
                    >{{$t('nft.msg_no_floor')}}</div>
                </div>
                <q-btn
                    v-if="!selecting"
                    flat
                    dense
                    round
                    color="primary"
                    icon="o_slideshow"
                    :aria-label="$t('gallery.action_play')"
                    @click="playGallery()"
                />
                <q-btn
                    flat
                    dense
                    no-caps
                    color="primary"
                    :icon="selecting ? 'close' : 'o_checklist'"
                    :label="selecting ? $t('common.cancel') : $t('nft.action_select')"
                    @click="toggleSelecting()"
                />
            </div>
            <div class="row q-gutter-x-md text-muted portfolio-meta q-mt-xs">
                <span>{{$t('nft.label_count', { n: total })}}</span>
                <span v-if="listedCount">{{$t('nft.label_listed_count', { n: listedCount })}}</span>
                <span
                    v-if="offerCount"
                    class="text-primary"
                >{{$t('nft.label_offer_count', { n: offerCount })}}</span>
                <span v-if="unpriced">{{$t('nft.label_unpriced', { n: unpriced })}}</span>
            </div>
            <nft-value-chart :collections="collections" />
        </div>

        <!-- collections: filter; sort and listed/unlisted -->
        <div
            v-if="total"
            class="collections row no-wrap q-gutter-x-sm"
        >
            <q-btn
                outline
                dense
                no-caps
                rounded
                class="sort-btn"
                :color="sort !== 'default' || status !== 'all' ? 'primary' : undefined"
                icon="o_tune"
                :aria-label="$t('nft.label_sort')"
            >
                <q-menu
                    anchor="bottom left"
                    self="top left"
                >
                    <q-list style="min-width: 220px">
                        <q-item-label header>{{$t('nft.label_sort')}}</q-item-label>
                        <q-item
                            v-for="o in sortOptions"
                            :key="o.value"
                            v-close-popup
                            clickable
                            :active="sort === o.value"
                            @click="setSort(o.value)"
                        >
                            <q-item-section>{{o.label}}</q-item-section>
                        </q-item>
                        <q-separator />
                        <q-item-label header>{{$t('nft.label_show')}}</q-item-label>
                        <q-item
                            v-for="o in statusOptions"
                            :key="o.value"
                            v-close-popup
                            clickable
                            :active="status === o.value"
                            @click="setStatus(o.value)"
                        >
                            <q-item-section>{{o.label}}</q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
            <button
                v-if="collections.length > 1"
                type="button"
                class="chip"
                :class="{ 'chip--active': !collection }"
                @click="select('')"
            >
                {{$t('nft.label_all')}} <span class="chip-count">{{total}}</span>
            </button>
            <button
                v-for="c in collections.length > 1 ? collections : []"
                :key="c.slug"
                type="button"
                class="chip row no-wrap items-center"
                :class="{ 'chip--active': collection === c.slug }"
                @click="select(c.slug)"
            >
                <img
                    :src="c.image"
                    alt=""
                    class="chip-image"
                    loading="lazy"
                >
                <span class="ellipsis">{{c.name}}</span>
                <span class="chip-count">{{c.count}}</span>
            </button>
        </div>

        <!-- the NFTs -->
        <div
            v-if="hiddenCount || favoriteCount"
            class="q-px-md q-pb-sm row q-gutter-x-xs"
        >
            <button
                v-if="favoriteCount"
                type="button"
                class="chip"
                :class="{ 'chip--active': onlyFavorites }"
                :aria-pressed="onlyFavorites"
                @click="onlyFavorites = !onlyFavorites"
            >
                <q-icon
                    name="star"
                    size="14px"
                    color="amber"
                />
                {{$t('nft.label_favorites', { n: favoriteCount })}}
            </button>
            <button
                v-if="hiddenCount"
                type="button"
                class="chip"
                :class="{ 'chip--active': showHidden }"
                @click="showHidden = !showHidden"
            >
                <q-icon
                    :name="showHidden ? 'o_visibility' : 'o_visibility_off'"
                    size="14px"
                />
                {{showHidden ? $t('nft.action_hide_hidden') : $t('nft.label_hidden', { n: hiddenCount })}}
            </button>
        </div>
        <div
            v-if="visibleItems.length"
            class="grid"
        >
            <router-link
                v-for="nft in visibleItems"
                :key="nft.contract + nft.tokenId"
                v-slot="{ href, navigate }"
                custom
                :to="{ name: 'nft', params: { walletId, addressIndex, contract: nft.contract, tokenId: nft.tokenId } }"
            >
                <a
                    v-touch-hold:600.mouse="() => quickMenu(nft)"
                    :href="href"
                    class="nft bvm-tile"
                    :class="{ 'nft--selected': isSelected(nft), 'nft--selecting': selecting }"
                    @click="selecting ? ($event.preventDefault(), toggle(nft)) : openNft($event, nft, navigate)"
                >
                    <div
                        v-if="selecting"
                        class="nft-check flex flex-center"
                    >
                        <q-icon
                            v-if="isSelected(nft)"
                            name="check"
                            size="16px"
                        />
                    </div>
                    <q-img
                        :src="nft.image"
                        :ratio="1"
                        class="nft-image"
                        spinner-color="primary"
                        spinner-size="24px"
                    >
                        <div
                            v-if="nft.rank"
                            class="nft-rank"
                        >#{{nft.rank}}</div>
                        <q-icon
                            v-if="isFavoriteNft(nft)"
                            name="star"
                            class="nft-star"
                            size="18px"
                            :aria-label="$t('nft.label_favorite')"
                        />
                    </q-img>
                    <div class="nft-body">
                        <div class="nft-name ellipsis">{{nft.name}}</div>
                    <div
                        v-if="showHidden && isHiddenNft(nft)"
                        class="nft-hidden-tag"
                    >{{verified && !verified.has(nft.collectionSlug) ? $t('nft.label_unverified') : $t('nft.label_hidden_one')}}</div>
                        <div class="nft-collection ellipsis">{{nft.collection}}</div>
                        <div
                            v-if="labelOf(nft)"
                            class="nft-label ellipsis"
                        >
                            <q-icon
                                name="o_sell"
                                size="11px"
                            /> {{labelOf(nft)}}
                        </div>
                        <div
                            v-if="nft.listed && nft.displayPrice"
                            class="nft-price bvm-amount"
                        >{{nft.displayPrice}} {{nft.currency}}</div>
                    </div>
                </a>
            </router-link>
        </div>

        <!-- states -->
        <div
            v-if="loading && !items.length"
            class="grid"
        >
            <div
                v-for="i in 6"
                :key="i"
                class="nft bvm-tile"
            >
                <q-skeleton
                    square
                    class="skeleton-image"
                />
                <div class="nft-body">
                    <q-skeleton
                        type="text"
                        width="70%"
                    />
                    <q-skeleton
                        type="text"
                        width="45%"
                    />
                </div>
            </div>
        </div>
        <div
            v-else-if="loading"
            class="row justify-center q-py-lg"
        >
            <q-spinner-dots
                color="primary"
                size="28px"
            />
        </div>
        <div
            v-else-if="error"
            class="state"
        >
            <q-icon
                name="o_cloud_off"
                size="32px"
                class="text-muted"
            />
            <div class="q-mt-sm">{{$t('nft.msg_unreachable')}}</div>
            <q-btn
                outline
                no-caps
                color="primary"
                class="q-mt-md"
                :label="$t('nft.action_retry')"
                @click="reload()"
            />
        </div>
        <div
            v-else-if="!items.length"
            class="state"
        >
            <q-icon
                name="o_photo_library"
                size="32px"
                class="text-muted"
            />
            <div class="q-mt-sm">{{$t('nft.msg_empty')}}</div>
            <q-btn
                outline
                no-caps
                color="primary"
                class="q-mt-md"
                icon="o_storefront"
                :label="$t('nft.action_explore')"
                @click="openURL(marketURL)"
            />
            <div
                v-if="ideas.length"
                class="ideas q-mt-md"
            >
                <button
                    v-for="c in ideas"
                    :key="c.slug"
                    type="button"
                    class="idea bvm-tile"
                    @click="openURL($svc.bvm.collectionPage(c.slug))"
                >
                    <img
                        :src="c.coverImage"
                        alt=""
                        loading="lazy"
                    >
                    <span class="ellipsis">{{c.name}}</span>
                </button>
            </div>
            <q-btn
                outline
                no-caps
                color="primary"
                class="q-mt-md"
                icon-right="o_north_east"
                :label="$t('nft.action_explore')"
                @click="openURL(marketURL)"
            />
        </div>
        <div
            v-else-if="hasMore && !selecting"
            class="q-pa-md"
        >
            <q-btn
                outline
                no-caps
                color="primary"
                class="full-width"
                :label="$t('nft.action_load_more')"
                @click="load()"
            />
        </div>

        <!-- bulk actions -->
        <div
            v-if="selecting"
            class="bulk-bar row no-wrap items-center q-gutter-x-sm"
        >
            <div class="col row no-wrap items-center">
                <span class="count-badge">{{selected.length}}</span>
                <span class="q-ml-sm text-weight-bold ellipsis">{{$t('nft.label_selected_short')}}</span>
            </div>
            <q-btn
                outline
                no-caps
                color="primary"
                icon="o_north_east"
                :disable="!sendable.length"
                :label="$t('nft.action_send')"
                @click="bulkSend()"
            />
            <q-btn
                unelevated
                no-caps
                color="primary"
                icon="o_sell"
                :disable="!listable.length"
                :label="$t('market.action_list')"
                @click="bulkList()"
            />
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent, markRaw } from 'vue'
import { marketURL, type BVM } from 'boot/services/bvm'
import { openURL } from 'src/utils/open-url'
import { address as addressUtil } from 'thor-devkit'
import PromptDialog, { type PromptOptions } from 'pages/Index/PromptDialog.vue'
import ListDialog, { type ListResult } from 'pages/Nft/ListDialog.vue'
import { canTrade, listClauses, listingCurrencies, sendClauses, signMarketTx } from 'src/utils/market'
import { toWei } from 'src/utils/format'
import { readSnapshot, writeSnapshot } from 'src/utils/snapshot'
import { navigateWithHero } from 'src/utils/hero'
import { loadNotes, noteOf, type NftNotes } from 'src/utils/nft-notes'
import NftValueChart from 'components/NftValueChart.vue'
import { isFavorite, isHidden, loadHidden, nftKey, saveHidden, toggleFavorite, type HiddenNfts } from 'src/utils/hidden-nfts'
import { shareCard } from 'src/utils/share-card'
import GalleryDialog from 'components/GalleryDialog.vue'
import { haptic } from 'src/utils/prefs'
import SuccessDialog from 'components/SuccessDialog.vue'
import RecipientCheckDialog from 'pages/Send/RecipientCheckDialog.vue'
import { findLookalike, isKnownRecipient, rememberRecipient } from 'src/utils/recipient'

// one transaction carries at most this many NFTs, as on blackvemarket.com
const MAX_BATCH = 30

const PAGE = 30

// the NFTs an address holds, from the BlackVeMarket index
export default defineComponent({
    components: { NftValueChart },
    props: {
        address: { type: String, required: true },
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true },
        gid: { type: String, required: true }
    },
    emits: ['total'],
    data: () => ({
        items: [] as BVM.NFT[],
        collections: [] as BVM.OwnedCollection[],
        total: 0,
        collection: '',
        offset: 0,
        hasMore: false,
        loading: false,
        error: false,
        listedCount: 0,
        offerCount: 0,
        selecting: false,
        sort: 'default',
        status: 'all' as 'all' | 'listed' | 'unlisted',
        ideas: [] as BVM.Collection[],
        hiddenPrefs: { hidden: [], shown: [] } as HiddenNfts,
        verified: null as Set<string> | null,
        showHidden: false,
        onlyFavorites: false,
        notes: {} as NftNotes,
        selected: [] as BVM.NFT[],
        marketURL
    }),
    computed: {
        visibleItems(): BVM.NFT[] {
            const shown = this.showHidden ? this.items : this.items.filter(n => !this.isHiddenNft(n))
            if (this.onlyFavorites) {
                return shown.filter(n => this.isFavoriteNft(n))
            }
            // starred ones first, otherwise in the order asked for
            return [...shown.filter(n => this.isFavoriteNft(n)), ...shown.filter(n => !this.isFavoriteNft(n))]
        },
        favoriteCount(): number {
            return this.items.filter(n => this.isFavoriteNft(n)).length
        },
        hiddenCount(): number {
            return this.items.filter(n => this.isHiddenNft(n)).length
        },
        sortOptions(): { value: string, label: string }[] {
            return [
                { value: 'default', label: this.$t('nft.sort_default') },
                { value: 'rank', label: this.$t('nft.sort_rank') },
                { value: 'collection', label: this.$t('nft.sort_collection') },
                { value: 'token', label: this.$t('nft.sort_token') },
                { value: 'price-low', label: this.$t('nft.sort_price_low') },
                { value: 'price-high', label: this.$t('nft.sort_price_high') }
            ]
        },
        statusOptions(): { value: 'all' | 'listed' | 'unlisted', label: string }[] {
            return [
                { value: 'all', label: this.$t('nft.label_all') },
                { value: 'listed', label: this.$t('nft.status_listed') },
                { value: 'unlisted', label: this.$t('nft.status_unlisted') }
            ]
        },
        /** the estimated value per currency, from collection floors */
        worth(): string[] {
            const sums: Record<string, number> = {}
            for (const c of this.collections) {
                if (c.floorAmount != null && c.floorCurrency) {
                    sums[c.floorCurrency] = (sums[c.floorCurrency] || 0) + c.floorAmount * c.count
                }
            }
            return Object.entries(sums)
                .sort((a, b) => b[1] - a[1])
                .map(([cur, v]) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cur}`)
        },
        /** NFTs in collections without a floor */
        unpriced(): number {
            return this.collections.filter(c => c.floorAmount == null).reduce((n, c) => n + c.count, 0)
        },
        sendable(): BVM.NFT[] {
            return this.selected.filter(n => !n.listed)
        },
        listable(): BVM.NFT[] {
            return this.selected.filter(n => !n.listed && canTrade(n))
        }
    },
    watch: {
        address: {
            immediate: true,
            handler() {
                this.collection = ''
                void this.reload()
            }
        }
    },
    async created() {
        this.hiddenPrefs = await loadHidden(this.$svc)
        this.notes = await loadNotes(this.$svc)
        this.$svc.bvm.collections()
            .then(c => { this.verified = new Set(Object.values(c).map(x => x.slug)) })
            .catch(() => { })
    },
    methods: {
        openURL,
        playGallery() {
            const items = this.visibleItems.filter(n => n.image).map(n => ({
                contract: n.contract, tokenId: n.tokenId, image: n.image, name: n.name, collection: n.collection
            }))
            if (items.length) {
                this.$dialog({ component: GalleryDialog, items }).catch(() => { })
            }
        },
        /** a held card: the things to do with this one NFT */
        quickMenu(nft: BVM.NFT) {
            if (this.selecting) return
            haptic()
            type Action = { label: string, icon: string, id: string }
            const actions: Action[] = []
            if (!nft.listed && canTrade(nft)) actions.push({ label: this.$t('market.action_list'), icon: 'o_sell', id: 'list' })
            if (!nft.listed) actions.push({ label: this.$t('nft.action_send'), icon: 'o_north_east', id: 'send' })
            actions.push(this.isFavoriteNft(nft)
                ? { label: this.$t('nft.action_unfavorite'), icon: 'star', id: 'favorite' }
                : { label: this.$t('nft.action_favorite'), icon: 'star_outline', id: 'favorite' })
            actions.push({ label: this.$t('share.action'), icon: 'o_ios_share', id: 'share' })
            actions.push({ label: this.$t('nft.action_hide'), icon: 'o_visibility_off', id: 'hide' })
            actions.push({ label: this.$t('nft.action_view_market'), icon: 'o_open_in_new', id: 'market' })
            this.$q.bottomSheet({ message: nft.name, actions }).onOk((a: Action) => {
                switch (a.id) {
                    case 'list': void this.bulkList([nft]); break
                    case 'send': void this.bulkSend([nft]); break
                    case 'favorite': void this.favorite(nft); break
                    case 'share': void shareCard({ title: nft.name, subtitle: nft.collection, image: nft.image }).catch(() => { }); break
                    case 'hide': void this.hideNft(nft); break
                    case 'market': openURL(this.$svc.bvm.nftPage(nft.contract, nft.tokenId)); break
                }
            })
        },
        async hideNft(nft: BVM.NFT) {
            const key = nftKey(nft.contract, nft.tokenId)
            const h = await loadHidden(this.$svc)
            h.shown = h.shown.filter(k => k !== key)
            h.hidden = [...h.hidden.filter(k => k !== key), key]
            await saveHidden(this.$svc, h)
            this.hiddenPrefs = h
            this.$q.notify(this.$t('nft.msg_hidden'))
        },
        async favorite(nft: BVM.NFT) {
            const { prefs, favorite } = await toggleFavorite(this.$svc, nft)
            this.hiddenPrefs = prefs
            haptic(favorite ? 'success' : 'tap')
        },
        labelOf(nft: BVM.NFT): string {
            const n = noteOf(this.notes, nft)
            return n ? n.labels[0] || (n.note ? '📝' : '') : ''
        },
        isFavoriteNft(nft: BVM.NFT) {
            return isFavorite(this.hiddenPrefs, nft)
        },
        isHiddenNft(nft: BVM.NFT) {
            return isHidden(this.hiddenPrefs, this.verified, nft)
        },
        openNft(ev: MouseEvent, nft: BVM.NFT, navigate: (e?: MouseEvent) => unknown) {
            // a modified click (new tab) is the browser's
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) {
                return navigate(ev)
            }
            ev.preventDefault()
            const img = (ev.currentTarget as HTMLElement).querySelector<HTMLElement>('.nft-image')
            void navigateWithHero(this.$router,
                { name: 'nft', params: { walletId: this.walletId, addressIndex: this.addressIndex, contract: nft.contract, tokenId: nft.tokenId } },
                `${nft.contract.toLowerCase()}:${nft.tokenId}`, nft.image, img)
        },
        setSort(v: string) {
            if (v !== this.sort) {
                this.sort = v
                void this.reload()
            }
        },
        setStatus(v: 'all' | 'listed' | 'unlisted') {
            if (v !== this.status) {
                this.status = v
                void this.reload()
            }
        },
        toggleSelecting() {
            this.selecting = !this.selecting
            this.selected = []
        },
        isSelected(nft: BVM.NFT) {
            return this.selected.includes(nft)
        },
        toggle(nft: BVM.NFT) {
            if (this.isSelected(nft)) {
                this.selected = this.selected.filter(n => n !== nft)
            } else if (this.selected.length < MAX_BATCH) {
                this.selected = [...this.selected, nft]
            } else {
                this.$q.notify(this.$t('nft.msg_max_batch', { n: MAX_BATCH }))
            }
        },
        async bulkSend(only?: BVM.NFT[]) {
            const nfts = only || this.sendable
            let to: string
            try {
                const opts: PromptOptions = {
                    title: this.$t('nft.label_selected', { n: nfts.length }),
                    message: this.$t('nft.msg_send_to'),
                    model: '',
                    action: { label: this.$t('nft.action_send'), color: 'primary' },
                    validate: (input: string) => {
                        if (!addressUtil.test(input.trim())) {
                            return this.$t('send.msg_invalid_address')
                        }
                        return input.trim().toLowerCase() === this.address.toLowerCase() ? this.$t('send.msg_invalid_address') : ''
                    }
                }
                to = (await this.$dialog<string>({ component: PromptDialog, opts })).trim()
                if (!await isKnownRecipient(this.$svc, this.gid, to)) {
                    await this.$dialog({ component: RecipientCheckDialog, to, imitates: await findLookalike(this.$svc, this.gid, to) })
                }
            } catch {
                return
            }
            const comment = this.$t('nft.comment_bulk_send', { n: nfts.length })
            try {
                await this.$signTx(this.gid, {
                    message: sendClauses(nfts, this.address, to).map(c => ({ ...c, comment })),
                    options: { signer: this.address, comment }
                })
                void rememberRecipient(this.$svc, this.gid, to)
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('nft.msg_sent'), image: nfts[0]?.image }).catch(() => { })
                this.toggleSelecting()
            } catch { }
        },
        async bulkList(only?: BVM.NFT[]) {
            const nfts = only || this.listable
            let r: ListResult
            try {
                r = await this.$dialog<ListResult>({
                    component: ListDialog,
                    title: this.$t('market.action_list'),
                    action: this.$t('market.action_list'),
                    message: this.$t('nft.msg_bulk_price', { n: nfts.length })
                })
            } catch {
                return
            }
            const comment = this.$t('nft.comment_bulk_list', { n: nfts.length, price: `${r.price} ${r.symbol}` })
            try {
                await signMarketTx(this.$signTx, this.$svc.bvm, this.gid, this.address,
                    listClauses(nfts, toWei(r.price, 18), listingCurrencies[r.symbol]!), comment)
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('market.msg_listed'), image: nfts[0]?.image }).catch(() => { })
                this.toggleSelecting()
            } catch { }
        },
        select(slug: string) {
            if (this.collection !== slug) {
                this.collection = slug
                void this.reload()
            }
        },
        reload() {
            // last time's first page, until this one arrives
            const snap = !this.collection && this.sort === 'default' && this.status === 'all'
                ? readSnapshot<{ items: BVM.NFT[], total: number }>(`nfts:${this.address.toLowerCase()}`)?.value
                : null
            this.items = snap ? snap.items.map(n => markRaw(n)) : []
            this.total = snap ? snap.total : this.total
            this.offset = 0
            this.hasMore = false
            return this.load()
        },
        async load() {
            if (!this.address || this.loading) {
                return
            }
            const address = this.address
            const collection = this.collection
            this.loading = true
            this.error = false
            try {
                const r = await this.$svc.bvm.holdings(address, { offset: this.offset, limit: PAGE, collection, sort: this.sort, status: this.status })
                // ignore a response for a filter or address that is no longer shown
                if (address !== this.address || collection !== this.collection) {
                    return
                }
                const first = this.offset === 0
                this.items = [...(first ? [] : this.items), ...r.holdings.map(n => markRaw(n))]
                if (first && !collection && this.sort === 'default' && this.status === 'all') {
                    writeSnapshot(`nfts:${address.toLowerCase()}`, { items: r.holdings.slice(0, 12), total: r.summary.total })
                }
                this.offset = r.pagination.nextOffset
                this.hasMore = r.pagination.hasMore
                if (!r.summary.total && !this.ideas.length) {
                    // the most traded collections, as ideas
                    this.$svc.bvm.collections().then(c => { this.ideas = Object.values(c).slice(0, 3) }).catch(() => { })
                }
                if (!collection && this.status === 'all') {
                    this.collections = r.ownedCollections
                    this.total = r.summary.total
                    this.listedCount = r.summary.listed
                    this.offerCount = r.summary.offers || 0
                    this.$emit('total', this.total)
                }
            } catch (err) {
                console.warn('BlackVeMarket holdings:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.collections
  padding: 4px 16px 12px
  overflow-x: auto
  scrollbar-width: none

.chip
  flex: none
  max-width: 200px
  gap: 6px
  padding: 6px 10px
  border-radius: 999px
  border: 1px solid $hairline-2
  background: rgba(255, 255, 255, 0.03)
  color: $text-soft
  font: inherit
  font-size: 13px
  font-weight: 700
  cursor: pointer
  &:hover
    border-color: rgba(255, 255, 255, 0.28)

.chip--active
  border-color: var(--q-primary)
  color: var(--q-primary)
  background: color-mix(in srgb, var(--q-primary) 08%, transparent)

.chip-image
  width: 18px
  height: 18px
  border-radius: 4px
  object-fit: cover

.chip-count
  color: $text-muted
  font-variant-numeric: tabular-nums

.portfolio
  padding: 14px 16px

.portfolio-label
  font-size: 13px
  font-weight: 700

.portfolio-value
  font-size: 26px
  margin-top: 2px

.portfolio-meta
  font-size: 13px

.count-badge
  min-width: 26px
  height: 26px
  padding: 0 7px
  border-radius: 13px
  background: var(--q-primary)
  color: $on-primary
  font-weight: 900
  text-align: center
  line-height: 26px

.bulk-bar
  position: sticky
  bottom: 0
  margin: 0 16px 16px
  padding: 10px 12px
  border: 1px solid $hairline-2
  border-radius: $radius-lg
  background: rgba(17, 20, 19, 0.96)
  backdrop-filter: blur(6px)

.nft-label
  font-size: 11px
  font-weight: 700
  color: var(--q-primary)

.nft-star
  position: absolute
  top: 6px
  right: 6px
  color: #fcd34d
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7))

.nft-hidden-tag
  font-size: 11px
  font-weight: 800
  color: $warning

.skeleton-image
  width: 100%
  height: auto
  aspect-ratio: 1

.sort-btn
  flex: none
  padding: 2px 8px

.ideas
  display: grid
  grid-template-columns: repeat(3, 1fr)
  gap: 8px
  width: 100%
  max-width: 420px

.idea
  display: flex
  flex-direction: column
  gap: 6px
  padding: 0 0 8px
  overflow: hidden
  color: inherit
  font: inherit
  font-size: 12px
  font-weight: 700
  cursor: pointer
  img
    width: 100%
    aspect-ratio: 1
    object-fit: cover
  span
    padding: 0 6px

.nft--selecting .nft-image
  transition: transform 0.15s ease-out

.nft--selected .nft-image
  transform: scale(0.94)

.nft-check
  position: absolute
  top: 8px
  right: 8px
  z-index: 2
  width: 24px
  height: 24px
  border-radius: 50%
  border: 2px solid rgba(255, 255, 255, 0.7)
  background: rgba(0, 0, 0, 0.45)

.nft--selected
  border-color: var(--q-primary) !important
  .nft-check
    border-color: var(--q-primary)
    background: var(--q-primary)
    color: $on-primary

.grid
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))
  gap: 10px
  padding: 0 16px 16px

.nft
  position: relative
  display: block
  overflow: hidden
  color: inherit
  // the same card as a button while selecting
  width: 100%
  padding: 0
  font: inherit
  text-align: left
  cursor: pointer
  text-decoration: none
  transition: border-color 0.15s
  &:hover
    border-color: rgba(255, 255, 255, 0.22)

.nft-image
  background: rgba(255, 255, 255, 0.04)

.nft-rank
  top: 8px
  left: 8px
  right: auto
  bottom: auto
  padding: 2px 6px
  border-radius: 4px
  background: rgba(8, 10, 9, 0.8)
  font-size: 11px
  font-weight: 800

.nft-body
  padding: 10px 12px 12px

.nft-name
  font-size: 14px
  font-weight: 800

.nft-collection
  font-size: 12px
  color: $text-muted

.nft-price
  margin-top: 6px
  font-size: 13px
  color: var(--q-primary)

.state
  display: flex
  flex-direction: column
  align-items: center
  padding: 48px 24px
  text-align: center
  color: $text-muted
</style>
