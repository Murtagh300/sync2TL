<template>
    <div class="inline-block address">
        <template v-if="test(addr)">
            <!-- the same pattern for the same address everywhere: a look-alike shows a different one -->
            <img
                v-if="!noIcon"
                class="address-icon"
                :src="icon"
                alt=""
            >
            <span
                v-if="name"
                class="address-name"
                :title="checksumed"
            >{{name}}</span>
            <!-- anyone can register a look-alike .vet name: keep the address beside it -->
            <span
                v-if="name && isVetName"
                class="address-short"
            >{{shortString}}</span>
            <template v-if="!name">{{displayString}}</template>
        </template>
        <slot v-else>!!Invalid address!!</slot>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address } from 'thor-devkit'
import { nameOf } from 'src/utils/names'
import { identicon } from 'src/utils/identicon'

export default defineComponent({
    props: {
        addr: String as () => string | null,
        full: Boolean,
        /** show the address even when it has a name */
        noName: Boolean,
        /** leave out the identicon (where an avatar of the address is already shown) */
        noIcon: Boolean
    },
    computed: {
        checksumed(): string {
            return this.addr && address.test(this.addr) ? address.toChecksumed(this.addr) : ''
        },
        /** a contact or .vet name; never in full mode, which is for checking the address itself */
        name(): string {
            return this.full || this.noName ? '' : nameOf(this.addr)
        },
        icon(): string {
            return identicon(this.addr || '')
        },
        isVetName(): boolean {
            return this.name.endsWith('.vet')
        },
        shortString(): string {
            return this.checksumed ? this.checksumed.slice(0, 6) + '⋯' + this.checksumed.slice(-4) : ''
        },
        displayString(): string {
            if (!this.checksumed) {
                return ''
            }
            return this.full ? this.checksumed : this.checksumed.slice(0, 6) + '⋯' + this.checksumed.slice(-6)
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
.address-icon {
    width: 1.05em;
    height: 1.05em;
    margin-right: 0.3em;
    border-radius: 50%;
    vertical-align: -0.15em;
}
.address-name {
    font-weight: 700;
    letter-spacing: 0;
}
.address-short {
    margin-left: 0.4em;
    opacity: 0.6;
    font-size: 0.9em;
}
</style>
