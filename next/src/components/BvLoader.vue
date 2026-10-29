<template>
    <span
        class="bv-loader"
        role="progressbar"
        :aria-label="label"
        :style="{ width: px, height: px }"
    >
        <svg
            viewBox="0 0 100 100"
            aria-hidden="true"
        >
            <defs>
                <linearGradient
                    :id="gid"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                >
                    <stop
                        offset="0"
                        stop-color="currentColor"
                        stop-opacity="0"
                    />
                    <stop
                        offset="1"
                        stop-color="currentColor"
                    />
                </linearGradient>
            </defs>
            <!-- the dial: its ticks turn in clicks, like a vault's combination lock -->
            <g class="dial">
                <line
                    v-for="i in 24"
                    :key="i"
                    x1="50"
                    :y1="i % 6 === 1 ? 5 : 8"
                    x2="50"
                    y2="13"
                    class="tick"
                    :class="{ 'tick--major': i % 6 === 1 }"
                    :transform="`rotate(${(i - 1) * 15} 50 50)`"
                />
            </g>
            <!-- the accent sweeping round inside it -->
            <circle
                class="sweep"
                cx="50"
                cy="50"
                r="31"
                fill="none"
                :stroke="`url(#${gid})`"
                stroke-width="5"
                stroke-linecap="round"
                stroke-dasharray="70 125"
            />
            <!-- the handle: three spokes and a hub -->
            <g class="handle">
                <line
                    v-for="a in [0, 120, 240]"
                    :key="a"
                    x1="50"
                    y1="50"
                    x2="50"
                    y2="33"
                    :transform="`rotate(${a} 50 50)`"
                />
                <circle
                    cx="50"
                    cy="50"
                    r="6"
                />
            </g>
        </svg>
    </span>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { i18n } from 'src/boot/i18n'

let n = 0

// BlackVault's own "one moment": a vault dial turning; replaces Quasar's spinners
export default defineComponent({
    props: {
        /** a CSS size ("40px") or pixels */
        size: { type: [String, Number], default: '40px' }
    },
    data: () => ({
        gid: `bv-loader-${++n}`,
        // through the i18n instance: the loading modal mounts its own app, without the plugin
        label: i18n.global.t('common.loading')
    }),
    computed: {
        px(): string {
            const s = String(this.size)
            return /^\d+$/.test(s) ? `${s}px` : s
        }
    }
})
</script>
<style scoped>
.bv-loader {
    display: inline-block;
    color: var(--q-primary);
    vertical-align: middle;
}

.bv-loader svg {
    width: 100%;
    height: 100%;
    overflow: visible;
}

.tick {
    stroke: rgba(255, 255, 255, 0.28);
    stroke-width: 2.5;
    stroke-linecap: round;
}

.tick--major {
    stroke: currentColor;
    stroke-width: 3.5;
}

.dial {
    transform-origin: 50px 50px;
    animation: bv-click 2.4s steps(8, end) infinite;
}

.sweep {
    transform-origin: 50px 50px;
    animation: bv-sweep 1.1s cubic-bezier(0.55, 0.15, 0.35, 0.9) infinite;
    filter: drop-shadow(0 0 3px currentColor);
}

.handle {
    stroke: rgba(255, 255, 255, 0.85);
    stroke-width: 4;
    stroke-linecap: round;
    fill: currentColor;
    transform-origin: 50px 50px;
    animation: bv-handle 2.4s ease-in-out infinite;
}

@keyframes bv-click {
    to { transform: rotate(120deg); }
}

@keyframes bv-sweep {
    to { transform: rotate(360deg); }
}

@keyframes bv-handle {
    0%, 100% { transform: rotate(0deg); }
    45%, 55% { transform: rotate(-60deg); }
}

@media (prefers-reduced-motion: reduce) {
    .dial, .sweep, .handle {
        animation: none;
    }

    .bv-loader {
        animation: bv-breathe 2s ease-in-out infinite;
    }

    @keyframes bv-breathe {
        50% { opacity: 0.45; }
    }
}
</style>
