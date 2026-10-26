<template>
    <div>
        <div class="bvm-label q-mb-sm">{{$t('nft.label_traits')}}</div>
        <!-- what makes it special, in words -->
        <div
            v-if="highlights.rarest || highlights.valuable"
            class="bvm-tile q-pa-md q-mb-sm rarity-why"
        >
            <div
                v-if="highlights.rarest"
                class="row no-wrap items-start"
            >
                <q-icon
                    name="o_diamond"
                    color="primary"
                    size="20px"
                    class="q-mr-sm"
                />
                <span>{{$t('rarity.rarest', { trait: highlights.rarest.trait_type, value: highlights.rarest.value, pct: highlights.rarest.percentage })}}</span>
            </div>
            <div
                v-if="highlights.valuable && highlights.valuable.traitFloor"
                class="row no-wrap items-start q-mt-sm"
            >
                <q-icon
                    name="o_trending_up"
                    color="primary"
                    size="20px"
                    class="q-mr-sm"
                />
                <span>{{$t('rarity.valuable', { trait: highlights.valuable.trait_type, value: highlights.valuable.value, floor: highlights.valuable.traitFloor })}}</span>
            </div>
        </div>
        <div class="traits">
            <div
                v-for="t in sorted"
                :key="t.trait_type + t.value"
                class="bvm-tile trait"
                :class="{ 'trait--rare': t.percentage != null && t.percentage <= 5 }"
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
                <div
                    v-if="t.percentage != null"
                    class="rarity-bar"
                >
                    <span :style="{ width: rarityWidth(t.percentage) }" />
                </div>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { BVM } from 'boot/services/bvm'
import { traitHighlights } from 'src/utils/pricing'

// the traits of an NFT, rarest first, with what makes it special
export default defineComponent({
    props: {
        traits: { type: Array as PropType<BVM.Trait[]>, required: true },
        /** the collection's floor, to say what a trait is worth */
        floorValue: { type: Number as PropType<number | null | undefined>, default: undefined }
    },
    computed: {
        sorted(): BVM.Trait[] {
            return [...this.traits].sort((a, b) => (a.percentage ?? 101) - (b.percentage ?? 101))
        },
        highlights(): ReturnType<typeof traitHighlights> {
            return traitHighlights(this.traits, this.floorValue ?? undefined)
        }
    },
    methods: {
        /** rarer is fuller: 0.5% fills the bar, 50% barely shows */
        rarityWidth(pct: number) {
            return `${Math.max(6, Math.min(100, 100 - Math.log10(Math.max(pct, 0.1) * 10) * 40))}%`
        }
    }
})
</script>
<style lang="sass" scoped>
.rarity-why
  font-size: 14px
  line-height: 1.45

.traits
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))
  gap: 8px

.trait
  padding: 10px 12px

.trait--rare
  border-color: color-mix(in srgb, var(--q-primary) 45%, transparent) !important

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

.rarity-bar
  height: 3px
  margin-top: 6px
  border-radius: 2px
  background: rgba(255, 255, 255, 0.06)
  span
    display: block
    height: 100%
    border-radius: 2px
    background: var(--q-primary)
</style>
