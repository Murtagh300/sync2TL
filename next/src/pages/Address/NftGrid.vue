<template>
    <div class="nft-grid-page">
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
            <router-link
                v-for="nft in items"
                :key="nft.contract + nft.tokenId"
                class="nft bvm-tile"
                :to="{ name: 'nft', params: { walletId, addressIndex, contract: nft.contract, tokenId: nft.tokenId } }"
            >
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
            </router-link>
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
            v-else-if="hasMore"
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
    </div>
</template>
<script lang="ts">
import { defineComponent, markRaw } from 'vue'
import { marketURL, type BVM } from 'boot/services/bvm'
import { openURL } from 'src/utils/open-url'

const PAGE = 30

// the NFTs an address holds, from the BlackVeMarket index
export default defineComponent({
    props: {
        address: { type: String, required: true },
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true }
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
        marketURL
    }),
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

.grid
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))
  gap: 10px
  padding: 0 16px 16px

.nft
  display: block
  overflow: hidden
  color: inherit
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
