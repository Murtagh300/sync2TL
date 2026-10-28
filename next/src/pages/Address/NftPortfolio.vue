<template>
    <!-- portfolio: what the NFTs are worth at their collection floors -->
    <div class="bvm-tile portfolio">
        <!-- the label and the buttons on one line; the value gets the full width below -->
        <div class="row no-wrap items-center">
            <div class="col text-muted portfolio-label ellipsis">{{$t('nft.label_portfolio')}}</div>
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
        <template v-if="worth.length">
            <!-- one figure in euros (or dollars); the floors per currency under it -->
            <div
                v-if="fiat !== null"
                class="bvm-display bvm-amount portfolio-value"
            >≈ {{money(fiat)}}</div>
            <div :class="fiat !== null ? 'portfolio-sub text-muted' : 'bvm-display portfolio-value'"
            >{{fiat !== null ? worth.join(' + ') : `≈ ${worth.join(' + ')}`}}</div>
        </template>
        <div
            v-else
            class="text-muted q-mt-xs"
        >{{$t('nft.msg_no_floor')}}</div>
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
import { money, prefs } from 'src/utils/prefs'

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
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        fiat: null as number | null
    }),
    asyncComputed: {
        /** the floors in the chosen currency; null when a currency has no price */
        async fiat(): Promise<number | null> {
            const sums = this.sums
            const symbols = Object.keys(sums)
            if (!symbols.length) return null
            void prefs.currency
            const tokens = await this.$svc.config.token.all()
            const address = (sym: string) => sym === 'VET' ? null : tokens.find(t => t.symbol === sym)?.address
            const [stats, fx] = await Promise.all([this.$svc.prices.stats(symbols.map(address)), this.$svc.prices.fx(prefs.currency)])
            let total = 0
            for (const sym of symbols) {
                const a = address(sym)
                const s = stats[(a || '0x0000000000000000000000000000000000000000').toLowerCase()]
                if (a === undefined || !s) return null
                total += sums[sym]! * s.price * fx
            }
            return total
        }
    },
    methods: { money },
    computed: {
        /** the floor value per currency */
        sums(): Record<string, number> {
            const sums: Record<string, number> = {}
            for (const c of this.collections) {
                if (c.floorAmount != null && c.floorCurrency) {
                    sums[c.floorCurrency] = (sums[c.floorCurrency] || 0) + c.floorAmount * c.count
                }
            }
            return sums
        },
        /** the estimated value per currency, from collection floors */
        worth(): string[] {
            return Object.entries(this.sums)
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
  font-size: 28px
  margin-top: 4px

.portfolio-sub
  font-size: 13px
  font-weight: 700
  margin-top: 4px

.portfolio-meta
  font-size: 13px
</style>
