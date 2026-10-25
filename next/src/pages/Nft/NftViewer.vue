<template>
    <q-dialog
        ref="dialog"
        maximized
        transition-show="fade"
        transition-hide="fade"
        @hide="$emit('hide')"
    >
        <div class="viewer column no-wrap">
            <div class="viewer-head row items-center no-wrap q-px-sm">
                <q-btn
                    flat
                    round
                    icon="close"
                    :aria-label="$t('common.close')"
                    @click="close()"
                />
                <div
                    class="col text-center ellipsis viewer-name"
                    style="min-width: 0"
                >{{current?.name}}</div>
                <div class="viewer-count text-muted">{{index + 1}} / {{items.length}}</div>
            </div>
            <q-carousel
                v-model="slide"
                class="col viewer-stage"
                swipeable
                animated
                :arrows="$q.screen.gt.xs && items.length > 1"
                transition-prev="slide-right"
                transition-next="slide-left"
                control-color="white"
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
                        class="viewer-image"
                        :class="{ 'viewer-image--zoomed': zoomed && i === slide }"
                        :style="zoomed && i === slide ? { transformOrigin: origin } : undefined"
                        @dblclick="toggleZoom($event)"
                        @click="maybeZoom($event)"
                    >
                </q-carousel-slide>
            </q-carousel>
            <div class="viewer-hint text-center text-muted">{{$t('nft.msg_viewer_hint')}}</div>
        </div>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'

export type ViewerItem = { contract: string, tokenId: string, image: string, name: string }

// an NFT full screen: double tap to zoom, swipe to the next of the same collection
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        items: { type: Array as () => ViewerItem[], required: true },
        start: { type: Number, default: 0 }
    },
    data() {
        return {
            slide: this.start,
            zoomed: false,
            origin: '50% 50%',
            lastTap: 0
        }
    },
    computed: {
        index(): number {
            return this.slide
        },
        current(): ViewerItem | undefined {
            return this.items[this.slide]
        }
    },
    watch: {
        slide() { this.zoomed = false }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        close() {
            // the page follows to the NFT looked at last
            this.$emit('ok', this.slide)
            this.hide()
        },
        toggleZoom(ev: MouseEvent) {
            const el = ev.target as HTMLElement
            const r = el.getBoundingClientRect()
            this.origin = `${((ev.clientX - r.left) / r.width) * 100}% ${((ev.clientY - r.top) / r.height) * 100}%`
            this.zoomed = !this.zoomed
        },
        // touch screens don't always send dblclick: two taps within 300ms
        maybeZoom(ev: MouseEvent) {
            const now = Date.now()
            if (now - this.lastTap < 300) {
                this.toggleZoom(ev)
                this.lastTap = 0
            } else {
                this.lastTap = now
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.viewer
  background: #000
  width: 100vw
  height: 100%

.viewer-head
  min-height: 56px
  padding-top: env(safe-area-inset-top)
  color: #fff

.viewer-name
  font-weight: 800

.viewer-count
  min-width: 48px
  font-size: 13px
  text-align: right
  padding-right: 8px

.viewer-stage
  background: #000
  height: auto

.viewer-image
  max-width: 100%
  max-height: 100%
  object-fit: contain
  transition: transform 0.2s ease-out
  user-select: none
  -webkit-user-drag: none

.viewer-image--zoomed
  transform: scale(2.4)

.viewer-hint
  font-size: 12px
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom))
</style>
