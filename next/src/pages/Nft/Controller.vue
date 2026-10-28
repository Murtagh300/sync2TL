<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="nft ? '' : $t('nft.label_nfts')"
            :gid="wallet?.gid"
        >
            <q-btn
                v-if="nft"
                flat
                round
                :icon="favorite ? 'star' : 'star_outline'"
                :color="favorite ? 'amber' : undefined"
                :aria-label="$t(favorite ? 'nft.action_unfavorite' : 'nft.action_favorite')"
                :aria-pressed="favorite"
                @click="toggleFavorite()"
            />
            <q-btn
                :aria-label="$t('a11y.more')"
                v-if="nft"
                flat
                round
                icon="more_vert"
            >
                <q-menu
                    anchor="bottom right"
                    self="top right"
                >
                    <q-list style="min-width: 200px">
                        <q-item
                            v-close-popup
                            clickable
                            @click="share()"
                        >
                            <q-item-section avatar>
                                <q-icon name="o_ios_share" />
                            </q-item-section>
                            <q-item-section>{{$t('share.action')}}</q-item-section>
                        </q-item>
                        <q-item
                            v-if="isOwner"
                            v-close-popup
                            clickable
                            @click="setBackground()"
                        >
                            <q-item-section avatar>
                                <q-icon name="o_wallpaper" />
                            </q-item-section>
                            <q-item-section>{{prefs.homeBackground === nft?.image ? $t('gallery.action_unset_background') : $t('gallery.action_set_background')}}</q-item-section>
                        </q-item>
                        <q-item
                            v-close-popup
                            clickable
                            @click="toggleHidden()"
                        >
                            <q-item-section avatar>
                                <q-icon :name="hidden ? 'o_visibility' : 'o_visibility_off'" />
                            </q-item-section>
                            <q-item-section>{{hidden ? $t('nft.action_unhide') : $t('nft.action_hide')}}</q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
            <q-btn
                :aria-label="$t(watching ? 'collection.action_watching' : 'collection.action_watch')"
                v-if="nft"
                flat
                round
                :icon="watching ? 'visibility' : 'o_visibility'"
                :color="watching ? 'primary' : undefined"
                @click="toggleWatch()"
            />
        </page-toolbar>
        <page-content
            class="col"
            size="md"
        >
            <div
                v-if="!nft && hint"
                class="q-pa-md"
            >
                <img
                    :src="hint"
                    alt=""
                    class="hero-image hero-hint"
                    :style="{ viewTransitionName: heroName }"
                >
            </div>
            <div
                v-else-if="!nft"
                class="row justify-center q-py-xl"
            >
                <q-spinner-dots
                    v-if="!error"
                    color="primary"
                    size="28px"
                />
                <div
                    v-else
                    class="column items-center text-muted q-px-lg text-center"
                >
                    <q-icon
                        name="o_cloud_off"
                        size="32px"
                    />
                    <div class="q-mt-sm">{{$t('nft.msg_unreachable')}}</div>
                    <q-btn
                        outline
                        no-caps
                        color="primary"
                        class="q-mt-md"
                        :label="$t('nft.action_retry')"
                        @click="$asyncComputed.nft?.update()"
                    />
                </div>
            </div>
            <div
                v-else
                class="q-pa-md"
            >
                <q-img
                    :src="nft.image"
                    :ratio="1"
                    :style="hint ? { viewTransitionName: heroName } : undefined"
                    class="hero-image cursor-pointer"
                    spinner-color="primary"
                    @click="openViewer()"
                >
                    <div class="absolute-bottom-right hero-zoom flex flex-center">
                        <q-icon
                            name="o_open_in_full"
                            size="18px"
                        />
                    </div>
                </q-img>

                <router-link
                    class="bvm-label q-mt-lg block coll-link"
                    :to="{ name: 'collection', params: { slug: nft.collectionSlug } }"
                >{{nft.collection}} ›</router-link>
                <h1 class="nft-name bvm-display">{{nft.name}}</h1>

                <div class="row q-gutter-sm q-mt-sm">
                    <div
                        v-if="nft.rank"
                        class="pill"
                    >{{$t('nft.label_rank')}} #{{nft.rank}}</div>
                    <div
                        class="pill"
                        :class="{ 'pill--listed': nft.listed }"
                    >
                        <template v-if="nft.listed && nft.displayPrice">
                            {{$t('nft.label_listed')}} <span class="bvm-amount">{{nft.displayPrice}} {{nft.currency}}</span>
                        </template>
                        <template v-else>{{$t('nft.label_unlisted')}}</template>
                    </div>
                </div>

                <!-- actions -->
                <div class="column q-gutter-y-sm q-mt-lg">
                    <template v-if="isOwner && tradable">
                        <q-btn
                            v-if="!nft.listed"
                            unelevated
                            no-caps
                            size="lg"
                            color="primary"
                            icon="o_sell"
                            :label="$t('market.action_list')"
                            @click="list()"
                        />
                        <div
                            v-else
                            class="row no-wrap q-gutter-x-sm"
                        >
                            <!-- two equal buttons: same height, an icon each, one line each -->
                            <q-btn
                                class="col pair-btn"
                                unelevated
                                no-caps
                                no-wrap
                                color="primary"
                                icon="o_edit"
                                :label="$t('market.action_reprice')"
                                @click="reprice()"
                            />
                            <q-btn
                                class="col pair-btn"
                                outline
                                no-caps
                                no-wrap
                                color="negative"
                                icon="o_remove_shopping_cart"
                                :label="$t('market.action_unlist_short')"
                                @click="cancelListing()"
                            />
                        </div>
                    </template>
                    <template v-if="!isOwner && tradable">
                        <q-btn
                            v-if="nft.listed && nft.saleId"
                            unelevated
                            no-caps
                            size="lg"
                            color="primary"
                            icon="o_shopping_bag"
                            :label="$t('collection.action_buy_for', { price: nft.price })"
                            @click="buy()"
                        />
                        <q-btn
                            outline
                            no-caps
                            color="primary"
                            icon="o_local_offer"
                            :label="$t('offers.action_place')"
                            @click="makeOffer()"
                        />
                    </template>
                    <q-btn
                        v-if="isOwner && signable"
                        :unelevated="!(isOwner && tradable)"
                        :outline="isOwner && tradable"
                        no-caps
                        :size="isOwner && tradable ? 'md' : 'lg'"
                        color="primary"
                        icon="o_north_east"
                        :label="$t('nft.action_send')"
                        :disable="!canSend"
                        @click="send()"
                    />
                    <div
                        v-if="!signable"
                        class="text-muted text-center"
                        style="font-size: 13px"
                    >{{$t('nft.msg_watch_only')}}</div>
                    <div
                        v-else-if="sendBlock"
                        class="text-muted text-center"
                        style="font-size: 13px"
                    >{{sendBlock}}</div>
                    <q-btn
                        outline
                        no-caps
                        color="primary"
                        icon-right="o_open_in_new"
                        :label="$t('nft.action_view_market')"
                        @click="openURL($svc.bvm.nftPage(nft.contract, nft.tokenId))"
                    />
                </div>

                <nft-note-card
                    class="q-mt-lg"
                    :nft="nft"
                />
                <!-- offers -->
                <template v-if="offers.length">
                    <div class="bvm-label q-mt-lg q-mb-sm">{{$t('market.label_offers')}} · {{offers.length}}</div>
                    <q-list role="group" class="bvm-list">
                        <q-item
                            v-for="o in offers"
                            :key="o.id"
                        >
                            <q-item-section>
                                <q-item-label class="bvm-amount offer-amount">{{o.displayAmount}} {{o.currency}}</q-item-label>
                                <q-item-label caption>
                                    <address-label :addr="o.buyer" />
                                </q-item-label>
                            </q-item-section>
                            <q-item-section
                                v-if="!isOwner && isMine(o.buyer)"
                                side
                            >
                                <q-btn
                                    flat
                                    dense
                                    no-caps
                                    color="negative"
                                    :label="$t('offers.action_withdraw')"
                                    @click="withdrawOffer(o)"
                                />
                            </q-item-section>
                            <q-item-section
                                v-if="isOwner && tradable"
                                side
                            >
                                <q-btn
                                    unelevated
                                    dense
                                    no-caps
                                    color="primary"
                                    class="q-px-md"
                                    :label="$t('market.action_accept')"
                                    @click="acceptOffer(o)"
                                />
                            </q-item-section>
                        </q-item>
                    </q-list>
                </template>

                <p
                    v-if="nft.description"
                    class="description q-mt-lg"
                >{{nft.description}}</p>

                <nft-traits
                    v-if="nft.traits && nft.traits.length"
                    class="q-mt-lg"
                    :traits="nft.traits"
                    :floor-value="nft.intelligence?.collection?.floorValue"
                />

                <nft-details
                    class="q-mt-lg"
                    :nft="nft"
                    :pnl="pnl"
                    :last-sale="lastSale"
                />
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address as addressUtil } from 'thor-devkit'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import PromptDialog, { type PromptOptions } from 'pages/Index/PromptDialog.vue'
import { openURL } from 'src/utils/open-url'
import ListDialog, { type ListResult } from './ListDialog.vue'
import OfferDialog, { type OfferResult } from 'pages/Collection/OfferDialog.vue'
import { genesises } from 'src/consts'
import NftViewer, { type ViewerItem } from './NftViewer.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import RecipientCheckDialog from 'pages/Send/RecipientCheckDialog.vue'
import { findLookalike, isKnownRecipient, rememberRecipient } from 'src/utils/recipient'
import { acceptOfferClauses, buyClauses, cancelListingClauses, cancelOfferClauses, canTrade, listClauses, listingCurrencies, offerClauses, repriceClauses, sendClauses, signMarketTx, type Clause } from 'src/utils/market'
import { toWei } from 'src/utils/format'
import { emptyWatchlist, type Watchlist } from 'src/utils/alerts'
import { heroHint, HERO_NAME } from 'src/utils/hero'
import { isFavorite, isHidden, loadHidden, nftKey, saveHidden, toggleFavorite } from 'src/utils/hidden-nfts'
import { shareCard } from 'src/utils/share-card'
import NftNoteCard from './NftNoteCard.vue'
import NftTraits from './NftTraits.vue'
import NftDetails, { type NftPnl } from './NftDetails.vue'
import { listingSuggestions } from 'src/utils/pricing'
import { haptic, prefs } from 'src/utils/prefs'
import { canSign } from 'src/utils/watch'
import type { BVM } from 'boot/services/bvm'

// one NFT of the address, from the BlackVeMarket index; it can be sent from here
export default defineComponent({
    components: { PageToolbar, PageContent, AddressLabel, NftNoteCard, NftTraits, NftDetails },
    props: {
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true },
        contract: { type: String, required: true },
        tokenId: { type: String, required: true }
    },
    data: () => ({
        error: false,
        watching: false,
        prefs,
        activity: [] as BVM.ActivityEntry[],
        hidden: false,
        favorite: false,
        heroName: HERO_NAME,
        // async computed (see src/shims-async-computed.d.ts)
        wallet: null as M.Wallet | null,
        nft: null as BVM.NFT | null
    }),
    asyncComputed: {
        wallet(): Promise<M.Wallet | null> {
            return this.$svc.wallet.get(parseInt(this.walletId))
        },
        async nft(): Promise<BVM.NFT | null> {
            this.error = false
            try {
                const { nft, activity } = await this.$svc.bvm.nftWithActivity(this.contract, this.tokenId)
                this.activity = activity
                const list = await this.$svc.config.getJSON<Watchlist>('watchlist', emptyWatchlist())
                this.watching = list.collections.includes(nft.collectionSlug)
                const [h, cols] = await Promise.all([loadHidden(this.$svc), this.$svc.bvm.collections().catch(() => null)])
                this.hidden = isHidden(h, cols ? new Set(Object.values(cols).map(c => c.slug)) : null, nft)
                this.favorite = isFavorite(h, nft)
                return nft
            } catch (err) {
                console.warn('BlackVeMarket nft:', err)
                this.error = true
                return null
            }
        }
    },
    computed: {
        /** the picture the NFT card handed over, shown until the data arrives */
        hint(): string {
            return heroHint(`${this.contract.toLowerCase()}:${this.tokenId}`)
        },
        address(): string {
            return this.wallet ? this.wallet.meta.addresses[parseInt(this.addressIndex)] || '' : ''
        },
        isOwner(): boolean {
            const me = this.address.toLowerCase()
            const nft = this.nft
            if (!nft || !me) {
                return false
            }
            // a listed NFT shows its seller; BlackVeMarket leaves the owner empty for some collections
            return (nft.owner || '').toLowerCase() === me || (!!nft.listed && (nft.seller || '').toLowerCase() === me)
        },
        /** a watch-only wallet signs nothing: no buttons that would only fail */
        signable(): boolean {
            return canSign(this.wallet)
        },
        tradable(): boolean {
            return !!this.nft && canTrade(this.nft) && this.signable
        },
        offers(): BVM.Offer[] {
            return (this.nft?.offers || []).filter(o => !!o && !!o.amount)
        },
        floor(): string {
            return this.nft?.intelligence?.collection?.floor || ''
        },
        sendBlock(): string {
            if (!this.nft) {
                return ''
            }
            if (this.nft.listed) {
                return this.$t('nft.msg_listed_cannot_send').toString()
            }
            if (!this.isOwner) {
                return this.$t('nft.msg_not_owner').toString()
            }
            return ''
        },
        canSend(): boolean {
            return !!this.nft && !!this.wallet && !this.sendBlock
        },
        /** what this address paid (or that it minted), against the floor now */
        pnl(): NftPnl | null {
            const me = this.address.toLowerCase()
            if (!this.isOwner || !me) {
                return null
            }
            const num = (s?: string | null) => parseFloat(String(s || '').replace(/,/g, ''))
            const floor = this.nft?.intelligence?.collection
            const bought = this.activity.find(a => a.action === 'sale' && (a.buyer || '').toLowerCase() === me)
            if (bought && bought.displayAmount) {
                const paid = num(bought.displayAmount)
                const percent = floor && floor.floorValue && floor.floorCurrency === bought.currency && paid > 0
                    ? (floor.floorValue / paid - 1) * 100
                    : null
                return { paid: bought.displayAmount, currency: bought.currency || '', minted: false, percent }
            }
            const minted = this.activity.find(a => a.action === 'transfer' && (a.buyer || '').toLowerCase() === me &&
                (a as { actor?: string }).actor === '0x0000000000000000000000000000000000000000')
            return minted ? { paid: '', currency: '', minted: true, percent: null } : null
        },
        lastSale(): { displayPrice: string, currency: string } | null {
            return this.nft?.intelligence?.lastSale || null
        }
    },
    methods: {
        openURL,
        setBackground() {
            const image = this.nft?.image || ''
            prefs.homeBackground = prefs.homeBackground === image ? '' : image
            this.$q.notify(prefs.homeBackground ? this.$t('gallery.msg_background_set') : this.$t('gallery.msg_background_removed'))
        },
        async share() {
            const nft = this.nft
            if (!nft) return
            try {
                await shareCard({ title: nft.name, subtitle: nft.collection, image: nft.image }, this.$svc.bvm.nftPage(nft.contract, nft.tokenId))
            } catch { }
        },
        async toggleFavorite() {
            if (!this.nft) {
                return
            }
            this.favorite = (await toggleFavorite(this.$svc, this.nft)).favorite
            haptic(this.favorite ? 'success' : 'tap')
        },
        async toggleHidden() {
            const nft = this.nft
            if (!nft) {
                return
            }
            const key = nftKey(nft.contract, nft.tokenId)
            const h = await loadHidden(this.$svc)
            if (this.hidden) {
                h.hidden = h.hidden.filter(k => k !== key)
                h.shown = [...h.shown.filter(k => k !== key), key]
            } else {
                h.shown = h.shown.filter(k => k !== key)
                h.hidden = [...h.hidden.filter(k => k !== key), key]
            }
            await saveHidden(this.$svc, h)
            this.hidden = !this.hidden
            this.$q.notify(this.hidden ? this.$t('nft.msg_hidden') : this.$t('nft.msg_unhidden'))
        },
        async openViewer() {
            const nft = this.nft
            if (!nft) {
                return
            }
            // this NFT and the others of its collection on this address
            let items: ViewerItem[] = [{ contract: nft.contract, tokenId: nft.tokenId, image: nft.image, name: nft.name }]
            try {
                const h = await this.$svc.bvm.holdings(this.address, { collection: nft.collectionSlug, limit: 60 })
                const others = h.holdings
                    .filter(n => !(n.contract.toLowerCase() === nft.contract.toLowerCase() && n.tokenId === nft.tokenId))
                    .map(n => ({ contract: n.contract, tokenId: n.tokenId, image: n.image, name: n.name }))
                items = [...items, ...others]
            } catch { }
            try {
                const last = await this.$dialog<number>({ component: NftViewer, items, start: 0 })
                const to = items[last]
                if (to && last !== 0) {
                    void this.$router.replace({ name: 'nft', params: { walletId: this.walletId, addressIndex: this.addressIndex, contract: to.contract, tokenId: to.tokenId } })
                }
            } catch { }
        },
        async toggleWatch() {
            const slug = this.nft?.collectionSlug
            if (!slug) {
                return
            }
            const list = await this.$svc.config.getJSON<Watchlist>('watchlist', emptyWatchlist())
            const collections = this.watching ? list.collections.filter(s => s !== slug) : [...list.collections, slug]
            await this.$svc.config.setJSON('watchlist', { ...list, collections })
            this.watching = !this.watching
            this.$q.notify(this.watching ? this.$t('watchlist.msg_watching', { name: this.nft!.collection }) : this.$t('watchlist.msg_unwatched'))
        },
        async market(clauses: Clause[], comment: string, done: string) {
            const wallet = this.wallet
            if (!wallet) {
                return
            }
            try {
                await signMarketTx(this.$signTx, this.$svc.bvm, wallet.gid, this.address, clauses, comment)
                this.$dialog({
                    component: SuccessDialog,
                    title: comment,
                    message: done,
                    image: this.nft?.image,
                    link: this.nft ? { label: this.$t('nft.action_view_market'), url: this.$svc.bvm.nftPage(this.nft.contract, this.nft.tokenId) } : undefined
                }).catch(() => { })
                // BlackVeMarket picks it up within a minute
                setTimeout(() => void this.$asyncComputed.nft?.update(), 20 * 1000)
            } catch {
                // declined in the transaction dialog
            }
        },
        isMine(address: string) {
            return (address || '').toLowerCase() === this.address.toLowerCase()
        },
        async buy() {
            const nft = this.nft
            if (!nft) return
            const comment = this.$t('collection.comment_buy', { nft: nft.name, price: nft.price })
            try {
                await this.$signTx(genesises.main.id, {
                    message: buyClauses(nft).map(c => ({ ...c, comment })),
                    options: { comment }
                })
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('collection.msg_bought'), image: nft.image }).catch(() => { })
            } catch { }
        },
        async makeOffer() {
            const nft = this.nft
            if (!nft) return
            try {
                const r = await this.$dialog<OfferResult>({ component: OfferDialog, title: this.$t('offers.action_place'), message: nft.name, floor: this.floor })
                const comment = this.$t('offers.comment_nft', { nft: nft.name, price: `${r.price} ${r.symbol}` })
                await this.$signTx(genesises.main.id, {
                    message: offerClauses(nft, toWei(r.price, 18), r.symbol).map(c => ({ ...c, comment })),
                    options: { comment }
                })
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('offers.msg_placed'), image: nft.image }).catch(() => { })
            } catch { }
        },
        async withdrawOffer(offer: BVM.Offer) {
            const nft = this.nft
            if (!nft) return
            await this.market(cancelOfferClauses(nft, offer), this.$t('offers.comment_withdraw'), this.$t('offers.msg_withdrawn'))
        },
        async askPrice(title: string, action: string): Promise<{ wei: string, token: string, text: string } | null> {
            const nft = this.nft!
            // what similar NFTs sold for lately, for the suggestions
            const sales = await this.$svc.bvm.activity(nft.collectionSlug, 30).catch(() => [] as BVM.FeedItem[])
            try {
                const r = await this.$dialog<ListResult>({
                    component: ListDialog,
                    title,
                    action,
                    message: nft.name,
                    floor: this.floor,
                    suggestions: listingSuggestions(nft, sales),
                    initialSymbol: nft.currency || 'VET'
                })
                // the listing currencies all have 18 decimals
                return { wei: toWei(r.price, 18), token: listingCurrencies[r.symbol]!, text: `${r.price} ${r.symbol}` }
            } catch {
                return null
            }
        },
        async list() {
            const nft = this.nft
            const p = nft && await this.askPrice(this.$t('market.action_list'), this.$t('market.action_list'))
            if (!nft || !p) {
                return
            }
            await this.market(listClauses([nft], p.wei, p.token), this.$t('market.comment_list', { nft: nft.name, price: p.text }), this.$t('market.msg_listed'))
        },
        async reprice() {
            const nft = this.nft
            const p = nft && await this.askPrice(this.$t('market.action_reprice'), this.$t('market.action_reprice'))
            if (!nft || !p) {
                return
            }
            await this.market(repriceClauses(nft, p.wei, p.token), this.$t('market.comment_list', { nft: nft.name, price: p.text }), this.$t('market.msg_listed'))
        },
        async cancelListing() {
            const nft = this.nft
            if (!nft) {
                return
            }
            await this.market(cancelListingClauses([nft]), this.$t('market.comment_cancel', { nft: nft.name }), this.$t('market.msg_cancelled'))
        },
        async acceptOffer(offer: BVM.Offer) {
            const nft = this.nft
            if (!nft) {
                return
            }
            await this.market(
                acceptOfferClauses(nft, offer),
                this.$t('market.comment_accept', { nft: nft.name, amount: `${offer.displayAmount} ${offer.currency}` }),
                this.$t('market.msg_accepted'))
        },
        async send() {
            const nft = this.nft
            const wallet = this.wallet
            if (!nft || !wallet || !this.canSend) {
                return
            }
            const from = this.address
            let to: string
            try {
                const opts: PromptOptions = {
                    title: this.$t('nft.action_send').toString(),
                    message: this.$t('nft.msg_send_to').toString(),
                    model: '',
                    action: { label: this.$t('send.action_send').toString(), color: 'primary' },
                    validate: input => {
                        const v = input.trim()
                        if (!addressUtil.test(v)) {
                            return this.$t('send.msg_invalid_address').toString()
                        }
                        if (v.toLowerCase() === from.toLowerCase()) {
                            return this.$t('send.msg_invalid_address').toString()
                        }
                        return ''
                    }
                }
                to = (await this.$dialog<string>({ component: PromptDialog, opts })).trim()
                if (!await isKnownRecipient(this.$svc, wallet.gid, to)) {
                    await this.$dialog({ component: RecipientCheckDialog, to, imitates: await findLookalike(this.$svc, wallet.gid, to) })
                }
            } catch {
                return
            }

            const comment = `${this.$t('nft.action_send')}: ${nft.name}`
            try {
                await this.$signTx(wallet.gid, {
                    message: sendClauses([nft], from, to).map(c => ({ ...c, comment })),
                    options: { signer: from, comment }
                })
                void rememberRecipient(this.$svc, wallet.gid, to)
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('nft.msg_sent'), image: nft.image })
                    .catch(() => { })
                    .finally(() => this.$backOrHome())
            } catch {
                // declined in the transaction dialog
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.offer-amount
  font-size: 16px

.coll-link
  text-decoration: none

.hero-hint
  display: block
  width: 100%
  aspect-ratio: 1
  object-fit: cover

.hero-zoom
  width: 34px
  height: 34px
  margin: 10px
  padding: 0
  border-radius: 10px
  background: rgba(0, 0, 0, 0.55) !important

.hero-image
  border-radius: $radius-lg
  border: 1px solid $hairline
  background: rgba(255, 255, 255, 0.04)

.nft-name
  margin: 6px 0 0
  font-size: clamp(28px, 8vw, 40px)

.pill
  padding: 4px 10px
  border-radius: 999px
  border: 1px solid $hairline-2
  font-size: 13px
  font-weight: 700
  color: $text-soft

.pill--listed
  border-color: color-mix(in srgb, var(--q-primary) 50%, transparent)
  color: var(--q-primary)

.description
  color: $text-soft
  line-height: 1.55
  max-width: 60ch


.pair-btn
  min-height: 52px
  font-size: 15px
</style>
