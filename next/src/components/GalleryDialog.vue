<template>
    <q-dialog
        ref="dialog"
        maximized
        transition-show="fade"
        transition-hide="fade"
        @hide="$emit('hide')"
    >
        <div
            class="gallery"
            @click="playing = !playing"
        >
            <q-carousel
                v-model="slide"
                class="gallery-stage"
                animated
                infinite
                swipeable
                transition-prev="fade"
                transition-next="fade"
                :autoplay="playing ? 5000 : 0"
            >
                <q-carousel-slide
                    v-for="(n, i) in items"
                    :key="n.contract + n.tokenId"
                    :name="i"
                    class="flex flex-center q-pa-none"
                >
                    <img
                        :src="n.image"
                        :alt="n.name"
                        class="gallery-image"
                    >
                </q-carousel-slide>
            </q-carousel>
            <div class="gallery-caption">
                <div class="bvm-display gallery-name">{{current?.name}}</div>
                <div class="gallery-sub">{{current?.collection}} · {{slide + 1}} / {{items.length}}</div>
            </div>
            <q-btn
                flat
                round
                icon="close"
                class="gallery-close"
                :aria-label="$t('common.close')"
                @click.stop="hide()"
            />
            <q-icon
                v-if="!playing"
                name="pause"
                size="48px"
                class="gallery-paused"
            />
        </div>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'

export type GalleryItem = { contract: string, tokenId: string, image: string, name: string, collection: string }

// a slideshow of NFTs, full screen: tap to pause, swipe to go on
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        items: { type: Array as () => GalleryItem[], required: true }
    },
    data: () => ({
        slide: 0,
        playing: true
    }),
    computed: {
        current(): GalleryItem | undefined {
            return this.items[this.slide]
        }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() }
    }
})
</script>
<style lang="sass" scoped>
.gallery
  position: relative
  width: 100vw
  height: 100%
  background: #000
  cursor: pointer

.gallery-stage
  height: 100%
  background: #000

.gallery-image
  max-width: 100%
  max-height: 100%
  object-fit: contain

.gallery-caption
  position: absolute
  left: 0
  right: 0
  bottom: 0
  padding: 48px 20px calc(24px + env(safe-area-inset-bottom))
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8))
  pointer-events: none

.gallery-name
  font-size: 26px

.gallery-sub
  color: rgba(255, 255, 255, 0.7)
  font-weight: 700

.gallery-close
  position: absolute
  top: calc(12px + env(safe-area-inset-top))
  right: 12px
  color: #fff
  background: rgba(0, 0, 0, 0.4)

.gallery-paused
  position: absolute
  top: 50%
  left: 50%
  transform: translate(-50%, -50%)
  color: rgba(255, 255, 255, 0.8)
  pointer-events: none
</style>
