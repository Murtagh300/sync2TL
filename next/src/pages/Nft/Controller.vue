<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="nft ? nft.collection : $t('nft.label_nfts')"
            :gid="wallet?.gid"
        >
            <q-btn
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
                v-if="!nft"
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
                        @click="$asyncComputed.nft.update()"
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

                <div class="bvm-label q-mt-lg">{{nft.collection}}</div>
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
                            <q-btn
                                class="col"
                                unelevated
                                no-caps
                                size="lg"
                                color="primary"
                                icon="o_edit"
                                :label="$t('market.action_reprice')"
                                @click="reprice()"
                            />
                            <q-btn
                                class="col"
                                outline
                                no-caps
                                size="lg"
                                color="negative"
                                :label="$t('market.action_cancel_listing')"
                                @click="cancelListing()"
                            />
                        </div>
                    </template>
                    <q-btn
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
                        v-if="sendBlock"
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

                <!-- offers -->
                <template v-if="offers.length">
                    <div class="bvm-label q-mt-lg q-mb-sm">{{$t('market.label_offers')}} · {{offers.length}}</div>
                    <q-list class="bvm-list">
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

                <!-- traits -->
                <template v-if="nft.traits && nft.traits.length">
                    <div class="bvm-label q-mt-lg q-mb-sm">{{$t('nft.label_traits')}}</div>
                    <div class="traits">
                        <div
                            v-for="t in nft.traits"
                            :key="t.trait_type + t.value"
                            class="bvm-tile trait"
                        >
                            <div class="trait-type ellipsis">{{t.trait_type}}</div>
                            <div class="trait-value ellipsis">{{t.value}}</div>
                            <div
                                v-if="t.percentage != null || t.traitFloor"
                                class="trait-meta"
                            >
                                <span v-if="t.percentage != null">{{t.percentage}}%</span>
                                <span v-if="t.traitFloor"> · {{t.traitFloor}}</span>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- details -->
                <div class="bvm-label q-mt-lg q-mb-sm">{{$t('nft.label_details')}}</div>
                <div class="bvm-tile details">
                    <div
                        v-if="lastSale"
                        class="detail row"
                    >
                        <span class="text-muted">{{$t('nft.label_last_sale')}}</span>
                        <span class="q-ml-auto bvm-amount">{{lastSale.displayPrice}} {{lastSale.currency}}</span>
                    </div>
                    <div class="detail row no-wrap">
                        <span class="text-muted">{{$t('nft.label_contract')}}</span>
                        <address-label
                            class="q-ml-auto"
                            :addr="nft.contract"
                        />
                    </div>
                    <div class="detail row">
                        <span class="text-muted">{{$t('nft.label_token_id')}}</span>
                        <span class="q-ml-auto text-weight-bold">{{nft.tokenId}}</span>
                    </div>
                    <div class="detail row">
                        <span class="text-muted">{{$t('nft.label_standard')}}</span>
                        <span class="q-ml-auto text-weight-bold text-uppercase">{{nft.tokenStandard}}</span>
                    </div>
                </div>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { abi, address as addressUtil } from 'thor-devkit'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import PromptDialog, { type PromptOptions } from 'pages/Index/PromptDialog.vue'
import { openURL } from 'src/utils/open-url'
import ListDialog, { type ListResult } from './ListDialog.vue'
import NftViewer, { type ViewerItem } from './NftViewer.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import RecipientCheckDialog from 'pages/Send/RecipientCheckDialog.vue'
import { isKnownRecipient, rememberRecipient } from 'src/utils/recipient'
import { acceptOfferClauses, cancelListingClauses, canTrade, listClauses, listingCurrencies, repriceClauses, signMarketTx, type Clause } from 'src/utils/market'
import { toWei } from 'src/utils/format'
import { emptyWatchlist, type Watchlist } from 'src/utils/alerts'
import type { BVM } from 'boot/services/bvm'

const erc721TransferFrom = new abi.Function({
    constant: false,
    inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
})

const erc1155SafeTransferFrom = new abi.Function({
    constant: false,
    inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'id', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
        { name: 'data', type: 'bytes' }
    ],
    name: 'safeTransferFrom',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
})

// one NFT of the address, from the BlackVeMarket index; it can be sent from here
export default defineComponent({
    components: { PageToolbar, PageContent, AddressLabel },
    props: {
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true },
        contract: { type: String, required: true },
        tokenId: { type: String, required: true }
    },
    data: () => ({
        error: false,
        watching: false,
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
                const nft = await this.$svc.bvm.nft(this.contract, this.tokenId)
                const list = await this.$svc.config.getJSON<Watchlist>('watchlist', emptyWatchlist())
                this.watching = list.collections.includes(nft.collectionSlug)
                return nft
            } catch (err) {
                console.warn('BlackVeMarket nft:', err)
                this.error = true
                return null
            }
        }
    },
    computed: {
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
        tradable(): boolean {
            return !!this.nft && canTrade(this.nft)
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
        lastSale(): { displayPrice: string, currency: string } | null {
            return this.nft?.intelligence?.lastSale || null
        }
    },
    methods: {
        openURL,
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
                setTimeout(() => void this.$asyncComputed.nft.update(), 20 * 1000)
            } catch {
                // declined in the transaction dialog
            }
        },
        async askPrice(title: string, action: string): Promise<{ wei: string, token: string, text: string } | null> {
            const nft = this.nft!
            try {
                const r = await this.$dialog<ListResult>({
                    component: ListDialog,
                    title,
                    action,
                    message: nft.name,
                    floor: this.floor,
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
                    await this.$dialog({ component: RecipientCheckDialog, to })
                }
            } catch {
                return
            }

            const data = nft.tokenStandard === 'erc1155'
                ? erc1155SafeTransferFrom.encode(from, to, nft.tokenId, 1, '0x')
                : erc721TransferFrom.encode(from, to, nft.tokenId)
            const comment = `${this.$t('nft.action_send')}: ${nft.name}`
            try {
                await this.$signTx(wallet.gid, {
                    message: [{ to: nft.contract, value: '0', data, comment }],
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

.traits
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))
  gap: 8px

.trait
  padding: 10px 12px

.trait-type
  font-size: 12px
  color: $text-muted

.trait-value
  margin-top: 2px
  font-weight: 800

.trait-meta
  margin-top: 4px
  font-size: 12px
  color: var(--q-primary)

.details
  padding: 4px 14px

.detail
  padding: 10px 0
  font-size: 14px
  & + .detail
    border-top: 1px solid $hairline
</style>
