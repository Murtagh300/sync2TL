<template>
    <!-- a collection's floor over the last days: a line and the change -->
    <div
        v-if="shown.length > 1"
        class="floor-trend"
        :class="{ 'floor-trend--compact': compact }"
    >
        <div
            v-if="!compact"
            class="row items-center q-mb-xs"
        >
            <span class="text-muted trend-label">{{$t('floorTrend.label', { days })}}</span>
            <q-space />
            <q-btn-toggle
                v-model="days"
                dense
                no-caps
                unelevated
                size="sm"
                toggle-color="primary"
                color="dark"
                :options="[{ label: '7D', value: 7 }, { label: '30D', value: 30 }]"
            />
        </div>
        <div class="row no-wrap items-center">
            <sparkline
                class="col trend-line"
                :values="shown.map(p => p.value)"
                :label="$t('floorTrend.label', { days })"
            />
            <div class="trend-change q-ml-sm text-right">
                <div
                    v-if="!compact"
                    class="bvm-amount"
                >{{last}}</div>
                <div :class="change >= 0 ? 'text-primary' : 'text-negative'">{{change >= 0 ? '+' : ''}}{{change.toFixed(1)}}%</div>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Sparkline from './Sparkline.vue'
import { dailyFloors } from 'src/utils/floors'

export default defineComponent({
    components: { Sparkline },
    props: {
        slug: { type: String, required: true },
        compact: Boolean
    },
    data: () => ({
        days: 7,
        points: [] as { time: number, value: number, currency: string }[]
    }),
    computed: {
        shown(): { time: number, value: number, currency: string }[] {
            return dailyFloors(this.points, this.days, Date.now())
        },
        change(): number {
            const first = this.shown[0]?.value || 0
            const last = this.shown[this.shown.length - 1]?.value || 0
            return first > 0 ? (last / first - 1) * 100 : 0
        },
        last(): string {
            const p = this.shown[this.shown.length - 1]
            return p ? `${p.value} ${p.currency}` : ''
        }
    },
    watch: {
        slug: { handler() { void this.load() }, immediate: true }
    },
    methods: {
        async load() {
            try {
                this.points = await this.$svc.bvm.floorHistory(this.slug)
            } catch {
                this.points = []
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.trend-label
  font-size: 12px
  font-weight: 700

.trend-line
  height: 48px

.floor-trend--compact .trend-line
  height: 28px

.trend-change
  font-size: 12px
  font-weight: 700
  min-width: 52px
</style>
