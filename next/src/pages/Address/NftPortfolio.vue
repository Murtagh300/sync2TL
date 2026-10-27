<template>
    <!-- portfolio: what the NFTs are worth at their collection floors -->
    <div class="bvm-tile portfolio">
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
                @click="$emit('play')"
            />
            <q-btn
                flat
                dense
                no-caps
                color="primary"
                :icon="selecting ? 'close' : 'o_checklist'"
                :label="selecting ? $t('common.cancel') : $t('nft.action_select')"
                @click="$emit('select')"
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
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { BVM } from 'boot/services/bvm'
import NftValueChart from 'components/NftValueChart.vue'
import { numberLocale } from 'src/utils/format'

// the top of the NFT tab: the estimated value, counts, and the gallery and select buttons
export default defineComponent({
    components: { NftValueChart },
    props: {
        collections: { type: Array as PropType<BVM.OwnedCollection[]>, required: true },
        total: { type: Number, required: true },
        listedCount: { type: Number, default: 0 },
        offerCount: { type: Number, default: 0 },
        selecting: Boolean
    },
    emits: ['play', 'select'],
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
                .map(([cur, v]) => `${v.toLocaleString(numberLocale(), { maximumFractionDigits: 2 })} ${cur}`)
        },
        /** NFTs in collections without a floor */
        unpriced(): number {
            return this.collections.filter(c => c.floorAmount == null).reduce((n, c) => n + c.count, 0)
        }
    }
})
</script>
<style lang="sass" scoped>
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
</style>
