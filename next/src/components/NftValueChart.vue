<template>
    <!-- what the NFTs were worth each day of the last month, at the floors of those days -->
    <div
        v-if="series.length > 1"
        class="nft-value q-mt-sm"
    >
        <div class="row items-center text-muted value-label">
            <span>{{$t('nftValue.label', { currency })}}</span>
            <q-space />
            <span :class="change >= 0 ? 'text-primary' : 'text-negative'">{{change >= 0 ? '+' : ''}}{{$fixed(change, 1)}}%</span>
        </div>
        <sparkline
            class="value-line"
            :values="series"
            :label="$t('nftValue.label', { currency })"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Sparkline from './Sparkline.vue'
import { dailyFloors, type FloorPoint } from 'src/utils/floors'
import type { BVM } from 'boot/services/bvm'

const DAYS = 30

export default defineComponent({
    components: { Sparkline },
    props: {
        collections: { type: Array as () => BVM.OwnedCollection[], required: true }
    },
    data: () => ({
        currency: 'VET',
        series: [] as number[]
    }),
    computed: {
        change(): number {
            const first = this.series[0] || 0
            const last = this.series[this.series.length - 1] || 0
            return first > 0 ? (last / first - 1) * 100 : 0
        },
        key(): string {
            return this.collections.map(c => `${c.slug}:${c.count}`).join(',')
        }
    },
    watch: {
        key: { handler() { void this.load() }, immediate: true }
    },
    methods: {
        async load() {
            // the currency most of the value is in; the 25 most valuable collections
            const priced = this.collections.filter(c => c.floorAmount != null && c.floorCurrency)
            const byCurrency: Record<string, number> = {}
            priced.forEach(c => { byCurrency[c.floorCurrency!] = (byCurrency[c.floorCurrency!] || 0) + c.floorAmount! * c.count })
            const currency = Object.entries(byCurrency).sort((a, b) => b[1] - a[1])[0]?.[0]
            if (!currency) {
                this.series = []
                return
            }
            const top = priced.filter(c => c.floorCurrency === currency)
                .sort((a, b) => b.floorAmount! * b.count - a.floorAmount! * a.count)
                .slice(0, 25)
            const now = Date.now()
            const histories = await Promise.all(top.map(c => this.$svc.bvm.floorHistory(c.slug).catch(() => [] as FloorPoint[])))
            const days = Array.from({ length: DAYS + 1 }, (_, i) => 0 * i)
            top.forEach((c, k) => {
                const daily = dailyFloors(histories[k]!.filter(p => p.currency === currency), DAYS, now)
                // a collection without history: today's floor on every day
                const values = daily.length ? daily.map(p => p.value) : []
                for (let d = 0; d <= DAYS; d++) {
                    // align to the end: the last value is today
                    const v = values.length ? values[Math.max(0, values.length - 1 - (DAYS - d))]! : c.floorAmount!
                    days[d] = days[d]! + v * c.count
                }
            })
            this.currency = currency
            this.series = days
        }
    }
})
</script>
<style lang="sass" scoped>
.value-label
  font-size: 12px
  font-weight: 700

.value-line
  height: 44px
</style>
