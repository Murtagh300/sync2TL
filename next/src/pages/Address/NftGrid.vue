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
        </div>

        <!-- collections: filter -->
        <div
            v-if="collections.length > 1"
            class="collections row no-wrap q-gutter-x-sm"
        >
            <button
                type="button"
                class="chip"
                :class="{ 'chip--active': !collection }"
                @click="select('')"
            >
                {{$t('nft.label_all')}} <span class="chip-count">{{total}}</span>
            </button>
            <button
                v-for="c in collections"
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
            v-if="items.length"
            class="grid"
        >
            <component
                :is="selecting ? 'button' : 'router-link'"
                v-for="nft in items"
                :key="nft.contract + nft.tokenId"
                class="nft bvm-tile"
                :class="{ 'nft--selected': isSelected(nft) }"
                v-bind="selecting
                    ? { type: 'button', onClick: () => toggle(nft) }
                    : { to: { name: 'nft', params: { walletId, addressIndex, contract: nft.contract, tokenId: nft.tokenId } } }"
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
                </q-img>
                <div class="nft-body">
                    <div class="nft-name ellipsis">{{nft.name}}</div>
                    <div class="nft-collection ellipsis">{{nft.collection}}</div>
                    <div
                        v-if="nft.listed && nft.displayPrice"
                        class="nft-price bvm-amount"
                    >{{nft.displayPrice}} {{nft.currency}}</div>
                </div>
            </component>
        </div>

        <!-- states -->
        <div
            v-if="loading"
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
            <div class="col text-weight-bold">{{$t('nft.label_selected', { n: selected.length })}}</div>
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

// one transaction carries at most this many NFTs, as on blackvemarket.com
const MAX_BATCH = 30

const PAGE = 30

// the NFTs an address holds, from the BlackVeMarket index
export default defineComponent({
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
        selected: [] as BVM.NFT[],
        marketURL
    }),
    computed: {
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
    methods: {
        openURL,
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
        async bulkSend() {
            const nfts = this.sendable
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
            } catch {
                return
            }
            const comment = this.$t('nft.comment_bulk_send', { n: nfts.length })
            try {
                await this.$signTx(this.gid, {
                    message: sendClauses(nfts, this.address, to).map(c => ({ ...c, comment })),
                    options: { signer: this.address, comment }
                })
                this.$q.notify(this.$t('nft.msg_sent'))
                this.toggleSelecting()
            } catch { }
        },
        async bulkList() {
            const nfts = this.listable
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
                this.$q.notify(this.$t('market.msg_listed'))
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
            this.items = []
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
                const r = await this.$svc.bvm.holdings(address, { offset: this.offset, limit: PAGE, collection })
                // ignore a response for a filter or address that is no longer shown
                if (address !== this.address || collection !== this.collection) {
                    return
                }
                this.items = [...this.items, ...r.holdings.map(n => markRaw(n))]
                this.offset = r.pagination.nextOffset
                this.hasMore = r.pagination.hasMore
                if (!collection) {
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
  border-color: $primary
  color: $primary
  background: rgba(110, 231, 183, 0.08)

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

.bulk-bar
  position: sticky
  bottom: 0
  margin: 0 16px 16px
  padding: 10px 12px
  border: 1px solid $hairline-2
  border-radius: $radius-lg
  background: rgba(17, 20, 19, 0.96)
  backdrop-filter: blur(6px)

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
  border-color: $primary !important
  .nft-check
    border-color: $primary
    background: $primary
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
  color: $primary

.state
  display: flex
  flex-direction: column
  align-items: center
  padding: 48px 24px
  text-align: center
  color: $text-muted
</style>
