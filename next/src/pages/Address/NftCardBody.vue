<template>
    <div
        class="nft-card"
        :class="{ 'nft-card--selected': selected, 'nft-card--selecting': selecting }"
    >
        <div
            v-if="selecting"
            class="nft-check flex flex-center"
        >
            <q-icon
                v-if="selected"
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
                v-if="favorite"
                name="star"
                class="nft-star"
                size="18px"
                :aria-label="$t('nft.label_favorite')"
            />
        </q-img>
        <div class="nft-body">
            <div class="nft-name ellipsis">{{nft.name}}</div>
            <div
                v-if="hiddenTag"
                class="nft-hidden-tag"
            >{{hiddenTag}}</div>
            <div class="nft-collection ellipsis">{{nft.collection}}</div>
            <div
                v-if="label"
                class="nft-label ellipsis"
            >
                <q-icon
                    name="o_sell"
                    size="11px"
                /> {{label}}
            </div>
            <div
                v-if="nft.listed && nft.displayPrice"
                class="nft-price bvm-amount"
            >{{nft.displayPrice}} {{nft.currency}}</div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { BVM } from 'boot/services/bvm'

// what a card in the NFT grid shows: the image, rank, star, name, collection, note and price
export default defineComponent({
    props: {
        nft: { type: Object as PropType<BVM.NFT>, required: true },
        selecting: Boolean,
        selected: Boolean,
        favorite: Boolean,
        /** why a hidden NFT shows (when hidden ones are shown); '' otherwise */
        hiddenTag: { type: String, default: '' },
        /** the first label of its note */
        label: { type: String, default: '' }
    }
})
</script>
<style lang="sass" scoped>
.nft-image
  background: rgba(255, 255, 255, 0.04)

.nft-card--selecting .nft-image
  transition: transform 0.15s ease-out

.nft-card--selected .nft-image
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

.nft-card--selected .nft-check
  border-color: var(--q-primary)
  background: var(--q-primary)
  color: $on-primary

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

.nft-star
  position: absolute
  top: 6px
  right: 6px
  color: #fcd34d
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7))

.nft-body
  padding: 10px 12px 12px

.nft-name
  font-size: 14px
  font-weight: 800

.nft-hidden-tag
  font-size: 11px
  font-weight: 800
  color: $warning

.nft-collection
  font-size: 12px
  color: $text-muted

.nft-label
  font-size: 11px
  font-weight: 700
  color: var(--q-primary)

.nft-price
  margin-top: 6px
  font-size: 13px
  color: var(--q-primary)
</style>
