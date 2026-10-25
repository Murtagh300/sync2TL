<template>
    <svg
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="none"
        class="sparkline"
        role="img"
        :aria-label="label"
    >
        <defs>
            <linearGradient
                :id="gradientId"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
            >
                <stop
                    offset="0%"
                    :stop-color="color"
                    stop-opacity="0.28"
                />
                <stop
                    offset="100%"
                    :stop-color="color"
                    stop-opacity="0"
                />
            </linearGradient>
        </defs>
        <path
            v-if="area"
            :d="area"
            :fill="`url(#${gradientId})`"
        />
        <path
            v-if="line"
            :d="line"
            fill="none"
            :stroke="color"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
        />
    </svg>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

let seq = 0

// a small line of values, rising or falling in the accent or the warning color
export default defineComponent({
    props: {
        values: { type: Array as () => number[], default: () => [] },
        label: { type: String, default: '' }
    },
    data: () => ({
        width: 300,
        height: 64,
        gradientId: `spark-${++seq}`
    }),
    computed: {
        color(): string {
            const v = this.values
            return v.length > 1 && v[v.length - 1]! < v[0]! ? 'var(--q-negative)' : 'var(--q-primary)'
        },
        points(): [number, number][] {
            const v = this.values
            if (v.length < 2) {
                return []
            }
            const min = Math.min(...v)
            const max = Math.max(...v)
            const span = max - min || 1
            return v.map((y, i) => [
                (i / (v.length - 1)) * this.width,
                // keep 4px clear at top and bottom for the stroke
                4 + (1 - (y - min) / span) * (this.height - 8)
            ])
        },
        line(): string {
            return this.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
        },
        area(): string {
            return this.line ? `${this.line} L${this.width},${this.height} L0,${this.height} Z` : ''
        }
    }
})
</script>
<style scoped>
.sparkline {
    display: block;
    width: 100%;
    height: 64px;
}
</style>
