<template>
    <div class="price-chart">
        <div class="row items-end no-wrap">
            <div class="col">
                <div class="bvm-display chart-price">{{money(shownPrice * fx)}}</div>
                <div
                    v-if="change !== null"
                    class="chart-change"
                    :class="change >= 0 ? 'text-primary' : 'text-negative'"
                >{{change >= 0 ? '+' : ''}}{{$fixed(change, 2)}}% · {{scrubTime || rangeLabel}}</div>
            </div>
            <div class="ranges row no-wrap">
                <button
                    type="button"
                    class="range range--icon"
                    :class="{ 'range--on': candles }"
                    :aria-label="$t('asset.label_candles')"
                    :aria-pressed="candles"
                    @click="candles = !candles"
                ><q-icon
                    name="o_candlestick_chart"
                    size="16px"
                /></button>
                <button
                    v-for="r in ranges"
                    :key="r.hours"
                    type="button"
                    class="range"
                    :class="{ 'range--on': r.hours === hours }"
                    @click="hours = r.hours"
                >{{r.label}}</button>
            </div>
        </div>
        <div
            class="chart-area q-mt-sm"
            @pointermove="scrub"
            @pointerleave="scrubX = null"
        >
            <q-skeleton
                v-if="loading && !points.length"
                height="140px"
            />
            <svg
                v-else-if="points.length > 1"
                :viewBox="`0 0 ${W} ${H}`"
                preserveAspectRatio="none"
                class="chart-svg"
                role="img"
                :aria-label="$t('asset.label_chart')"
            >
                <template v-if="!candles">
                    <path
                        :d="area"
                        class="chart-fill"
                    />
                    <path
                        :d="line"
                        class="chart-line"
                        :class="{ 'chart-line--down': (change || 0) < 0 }"
                        vector-effect="non-scaling-stroke"
                    />
                </template>
                <template v-else>
                    <g
                        v-for="c in candleShapes"
                        :key="c.x"
                        :class="c.up ? 'candle-up' : 'candle-down'"
                    >
                        <line
                            :x1="c.x"
                            :x2="c.x"
                            :y1="c.high"
                            :y2="c.low"
                            class="candle-wick"
                            vector-effect="non-scaling-stroke"
                        />
                        <rect
                            :x="c.x - c.w / 2"
                            :y="Math.min(c.open, c.close)"
                            :width="c.w"
                            :height="Math.max(1, Math.abs(c.close - c.open))"
                            class="candle-body"
                        />
                    </g>
                    <path
                        v-if="maLine"
                        :d="maLine"
                        class="ma-line"
                        vector-effect="non-scaling-stroke"
                    />
                </template>
                <!-- what you paid on average -->
                <line
                    v-if="costY !== null"
                    x1="0"
                    :x2="W"
                    :y1="costY"
                    :y2="costY"
                    class="cost-line"
                    vector-effect="non-scaling-stroke"
                />
                <!-- your own transfers on the line -->
                <circle
                    v-for="(m, i) in markPoints"
                    :key="i"
                    :cx="m.x"
                    :cy="m.y"
                    r="4"
                    :class="m.direction === '+' ? 'mark-in' : 'mark-out'"
                    vector-effect="non-scaling-stroke"
                />
                <line
                    v-if="scrubX !== null"
                    :x1="scrubX"
                    :x2="scrubX"
                    y1="0"
                    :y2="H"
                    class="scrub-line"
                    vector-effect="non-scaling-stroke"
                />
            </svg>
            <div
                v-else
                class="text-muted text-center q-py-lg"
            >{{$t('asset.msg_no_chart')}}</div>
        </div>
        <div
            v-if="markPoints.length || costY !== null"
            class="row q-gutter-x-md text-muted legend q-mt-xs"
        >
            <template v-if="markPoints.length">
                <span><i class="dot mark-in-bg" /> {{$t('common.received')}}</span>
                <span><i class="dot mark-out-bg" /> {{$t('common.sent')}}</span>
            </template>
            <span v-if="costY !== null"><i class="dash" /> {{$t('asset.label_avg_buy_short')}}</span>
        </div>
        <div
            v-if="candles && candleList.length"
            class="row q-gutter-x-md text-muted legend q-mt-xs"
        >
            <span v-if="maLine"><i class="ma-key" /> {{$t('asset.label_ma', { n: MA })}}</span>
            <span v-if="rsiValue !== null">{{$t('asset.label_rsi', { value: Math.round(rsiValue) })}} · {{rsiWord}}</span>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import type { Prices } from 'boot/services/prices'
import { money, prefs } from 'src/utils/prefs'
import { formatDate } from 'src/utils/format'
import { bucketFor, rsi, sma, toCandles, type Candle } from 'src/utils/candles'

const MA = 10

export type ChartMark = { time: number, direction: '+' | '-' }

// a token's price over a day, week or month, with the holder's own transfers on it
export default defineComponent({
    props: {
        token: { type: Object as () => M.TokenSpec, required: true },
        marks: { type: Array as () => ChartMark[], default: () => [] },
        /** the average buy price in the chosen currency, as a dashed line; 0 for none */
        costPrice: { type: Number, default: 0 }
    },
    data: () => ({
        W: 600,
        H: 140,
        hours: 168,
        points: [] as Prices.Point[],
        loading: false,
        fx: 1,
        scrubX: null as number | null,
        prefs,
        MA,
        candles: (() => {
            try {
                return localStorage.getItem('bv-chart-candles') === '1'
            } catch {
                return false
            }
        })()
    }),
    computed: {
        ranges(): { hours: number, label: string }[] {
            return [
                { hours: 24, label: this.$t('asset.range_1d') },
                { hours: 168, label: this.$t('asset.range_1w') },
                { hours: 720, label: this.$t('asset.range_1m') }
            ]
        },
        rangeLabel(): string {
            return this.ranges.find(r => r.hours === this.hours)?.label || ''
        },
        span(): { t0: number, t1: number, min: number, max: number } {
            const p = this.points
            const prices = p.map(x => x.price)
            // the buy price in view too, when it is near the range
            const cost = this.costUsd
            if (cost > 0 && prices.length) {
                const lo = Math.min(...prices)
                const hi = Math.max(...prices)
                if (cost >= lo / 2 && cost <= hi * 2) prices.push(cost)
            }
            return { t0: p[0]?.time || 0, t1: p[p.length - 1]?.time || 1, min: Math.min(...prices), max: Math.max(...prices) }
        },
        /** the buy price in USD, as the points are */
        costUsd(): number {
            return this.costPrice > 0 && this.fx > 0 ? this.costPrice / this.fx : 0
        },
        costY(): number | null {
            const c = this.costUsd
            const { min, max } = this.span
            if (!c || this.points.length < 2 || c < min || c > max) return null
            return this.y(c, min, max)
        },
        xy(): [number, number][] {
            const { t0, t1, min, max } = this.span
            return this.points.map(p => [this.x(p.time, t0, t1), this.y(p.price, min, max)])
        },
        line(): string {
            return this.xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
        },
        area(): string {
            return `${this.line} L${this.W},${this.H} L0,${this.H} Z`
        },
        markPoints(): { x: number, y: number, direction: '+' | '-' }[] {
            const { t0, t1, min, max } = this.span
            return this.marks
                .filter(m => m.time >= t0 && m.time <= t1)
                .map(m => ({ x: this.x(m.time, t0, t1), y: this.y(this.priceAt(m.time), min, max), direction: m.direction }))
        },
        scrubIndex(): number | null {
            if (this.scrubX === null || this.points.length < 2) {
                return null
            }
            return Math.round((this.scrubX / this.W) * (this.points.length - 1))
        },
        shownPrice(): number {
            const i = this.scrubIndex
            const p = i !== null ? this.points[i] : this.points[this.points.length - 1]
            return p?.price || 0
        },
        scrubTime(): string {
            const i = this.scrubIndex
            return i !== null && this.points[i] ? formatDate(this.points[i]!.time, { relative: true }) : ''
        },
        candleList(): Candle[] {
            return toCandles(this.points, bucketFor(this.hours))
        },
        /** each candle in chart space: price high is y low */
        candleShapes(): { x: number, w: number, open: number, close: number, high: number, low: number, up: boolean }[] {
            const list = this.candleList
            const { min, max } = this.span
            const n = list.length
            if (!n) return []
            const step = this.W / n
            return list.map((c, i) => ({
                x: step * (i + 0.5),
                w: Math.max(1.5, step * 0.62),
                open: this.y(c.open, min, max),
                close: this.y(c.close, min, max),
                high: this.y(c.high, min, max),
                low: this.y(c.low, min, max),
                up: c.close >= c.open
            }))
        },
        maLine(): string {
            const list = this.candleList
            const { min, max } = this.span
            const step = this.W / (list.length || 1)
            const avg = sma(list.map(c => c.close), MA)
            const pts = avg.map((v, i) => v === null ? null : `${(step * (i + 0.5)).toFixed(1)},${this.y(v, min, max).toFixed(1)}`).filter(Boolean)
            return pts.length > 1 ? 'M' + pts.join(' L') : ''
        },
        rsiValue(): number | null {
            return rsi(this.candleList.map(c => c.close))
        },
        rsiWord(): string {
            const v = this.rsiValue ?? 50
            return v >= 70 ? this.$t('asset.rsi_high') : v <= 30 ? this.$t('asset.rsi_low') : this.$t('asset.rsi_mid')
        },
        change(): number | null {
            const first = this.points[0]?.price
            return first ? (this.shownPrice / first - 1) * 100 : null
        }
    },
    watch: {
        hours: { handler() { void this.load() }, immediate: true },
        candles(on: boolean) {
            try {
                localStorage.setItem('bv-chart-candles', on ? '1' : '0')
            } catch { }
        },
        'prefs.currency': {
            async handler(c: 'EUR' | 'USD') { this.fx = await this.$svc.prices.fx(c) },
            immediate: true
        }
    },
    methods: {
        money,
        x(t: number, t0: number, t1: number) {
            return ((t - t0) / (t1 - t0 || 1)) * this.W
        },
        y(price: number, min: number, max: number) {
            return 6 + (1 - (price - min) / (max - min || 1)) * (this.H - 12)
        },
        priceAt(t: number) {
            let price = this.points[0]?.price || 0
            for (const p of this.points) {
                if (p.time > t) break
                price = p.price
            }
            return price
        },
        scrub(ev: PointerEvent) {
            const el = ev.currentTarget as HTMLElement
            const r = el.getBoundingClientRect()
            this.scrubX = Math.max(0, Math.min(this.W, ((ev.clientX - r.left) / r.width) * this.W))
        },
        async load() {
            this.loading = true
            try {
                const h = await this.$svc.prices.history([this.token.address], this.hours)
                this.points = h[(this.token.address || '0x0000000000000000000000000000000000000000').toLowerCase()] || []
            } finally {
                this.loading = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.chart-price
  font-size: 28px

.chart-change
  font-size: 13px
  font-weight: 700

.ranges
  gap: 4px

.range
  padding: 4px 10px
  border-radius: 999px
  border: 1px solid $hairline-2
  background: none
  color: $text-muted
  font: inherit
  font-size: 12px
  font-weight: 800
  cursor: pointer

.range--on
  border-color: var(--q-primary)
  color: var(--q-primary)

.range--icon
  padding: 2px 7px
  display: flex
  align-items: center

.candle-wick
  stroke-width: 1

.candle-up
  stroke: var(--q-primary)
  fill: var(--q-primary)

.candle-down
  stroke: var(--q-negative)
  fill: var(--q-negative)

.ma-line
  fill: none
  stroke: #fcd34d
  stroke-width: 1.5

.ma-key
  display: inline-block
  width: 14px
  border-top: 2px solid #fcd34d
  vertical-align: middle
  margin-right: 4px

.chart-area
  touch-action: pan-y

.chart-svg
  display: block
  width: 100%
  height: 140px

.chart-line
  fill: none
  stroke: var(--q-primary)
  stroke-width: 2
  stroke-linejoin: round

.chart-line--down
  stroke: var(--q-negative)

.chart-fill
  fill: color-mix(in srgb, var(--q-primary) 10%, transparent)

.mark-in
  fill: var(--q-primary)
  stroke: #000
  stroke-width: 2

.mark-out
  fill: var(--q-warning)
  stroke: #000
  stroke-width: 2

.scrub-line
  stroke: rgba(255, 255, 255, 0.4)
  stroke-width: 1

.legend
  font-size: 12px

.cost-line
  stroke: rgba(255, 255, 255, 0.55)
  stroke-width: 1
  stroke-dasharray: 5 4

.dash
  display: inline-block
  width: 14px
  border-top: 1px dashed rgba(255, 255, 255, 0.7)
  vertical-align: middle
  margin-right: 4px

.dot
  display: inline-block
  width: 8px
  height: 8px
  border-radius: 50%
  margin-right: 4px

.mark-in-bg
  background: var(--q-primary)

.mark-out-bg
  background: var(--q-warning)
</style>
