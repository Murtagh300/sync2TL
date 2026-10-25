<template>
    <div class="inline-block address">
        <template v-if="test(addr)">
            <span
                v-if="name"
                class="address-name"
                :title="checksumed"
            >{{name}}</span>
            <template v-else>{{displayString}}</template>
        </template>
        <slot v-else>!!Invalid address!!</slot>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address } from 'thor-devkit'
import { nameOf } from 'src/utils/names'

export default defineComponent({
    props: {
        addr: String as () => string | null,
        full: Boolean,
        /** show the address even when it has a name */
        noName: Boolean
    },
    computed: {
        checksumed(): string {
            return this.addr && address.test(this.addr) ? address.toChecksumed(this.addr) : ''
        },
        /** a contact or .vet name; never in full mode, which is for checking the address itself */
        name(): string {
            return this.full || this.noName ? '' : nameOf(this.addr)
        },
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
.address-name {
    font-weight: 700;
    letter-spacing: 0;
}
</style>
