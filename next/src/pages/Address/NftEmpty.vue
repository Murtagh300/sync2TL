<template>
    <!-- no NFTs yet: where to find some -->
    <div class="nft-empty">
        <q-icon
            name="o_photo_library"
            size="32px"
            class="text-muted"
        />
        <div class="q-mt-sm">{{$t('nft.msg_empty')}}</div>
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
            icon="o_storefront"
            :label="$t('nft.action_explore')"
            @click="openURL(marketURL)"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { marketURL, type BVM } from 'boot/services/bvm'
import { openURL } from 'src/utils/open-url'

export default defineComponent({
    props: {
        /** collections worth a look (the most traded ones) */
        ideas: { type: Array as PropType<BVM.Collection[]>, default: () => [] }
    },
    data: () => ({ marketURL }),
    methods: { openURL }
})
</script>
<style lang="sass" scoped>
.nft-empty
  display: flex
  flex-direction: column
  align-items: center
  padding: 48px 24px
  text-align: center
  color: $text-muted

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
</style>
