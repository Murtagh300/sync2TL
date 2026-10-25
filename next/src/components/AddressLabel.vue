<template>
    <div class="inline-block address">
        <template v-if="test(addr)">
            {{displayString}}
        </template>
        <slot v-else>!!Invalid address!!</slot>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address } from 'thor-devkit'

export default defineComponent({
    props: {
        addr: String as () => string | null,
        full: Boolean
    },
    computed: {
        displayString(): string {
            if (!this.addr || !address.test(this.addr)) {
                return ''
            }
            const checksumed = address.toChecksumed(this.addr)
            return this.full ? checksumed : checksumed.slice(0, 6) + '⋯' + checksumed.slice(-6)
        }
    },
    methods: {
        test: (addr?: string | null) => !!addr && address.test(addr)
    }
})
</script>
<style scoped>
/* Geist with even-width digits, as the rest of the app (no condensed mono) */
.address {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    font-weight: 500;
    max-width: 100%;
    text-overflow: inherit;
    white-space: inherit;
    overflow: inherit;
    vertical-align: middle;
}
</style>
