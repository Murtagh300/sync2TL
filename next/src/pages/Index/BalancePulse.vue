<template>
    <div
        class="pulses"
        aria-live="polite"
    >
        <transition-group name="pulse">
            <div
                v-for="p in pulses"
                :key="p.key"
                class="pulse bvm-amount"
                :class="p.dir === 'in' ? 'pulse--in' : 'pulse--out'"
            >{{p.dir === 'in' ? '+' : '−'}}{{p.text}}</div>
        </transition-group>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import type { BalancePulse } from 'src/utils/notifications'
import { haptic } from 'src/utils/prefs'

let seq = 0

// "+50 VET" floating up over the total when a transfer lands, then the total refreshes
export default defineComponent({
    props: {
        walletId: { type: Number, required: true }
    },
    emits: ['changed'],
    data: () => ({
        pulses: [] as (BalancePulse & { key: number })[]
    }),
    created() {
        window.addEventListener('bv:balance', this.onPulse as (e: Event) => void)
    },
    beforeUnmount() {
        window.removeEventListener('bv:balance', this.onPulse as (e: Event) => void)
    },
    methods: {
        onPulse(ev: CustomEvent<BalancePulse>) {
            const p = ev.detail
            if (p.walletId !== this.walletId) {
                return
            }
            const key = ++seq
            this.pulses = [...this.pulses, { ...p, key }]
            p.dir === 'in' && haptic('success')
            this.$emit('changed')
            setTimeout(() => { this.pulses = this.pulses.filter(x => x.key !== key) }, 2600)
        }
    }
})
</script>
<style lang="sass" scoped>
.pulses
  position: relative
  height: 0

.pulse
  position: absolute
  right: 4px
  top: -36px
  font-size: 20px
  animation: rise 2.6s ease-out forwards

.pulse--in
  color: var(--q-primary)

.pulse--out
  color: $text-soft

@keyframes rise
  0%
    opacity: 0
    transform: translateY(10px)
  15%
    opacity: 1
    transform: translateY(0)
  80%
    opacity: 1
  100%
    opacity: 0
    transform: translateY(-24px)

.pulse-leave-active
  display: none
</style>
