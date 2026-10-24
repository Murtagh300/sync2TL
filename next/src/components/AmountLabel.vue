<template>
    <span>
        <template v-if="formatted">
            {{formatted.int}}<span
                style="font-size:80%"
                v-if="formatted.dec"
            >{{`${formatted.sep}${formatted.dec}`}}</span>
        </template>
        <slot v-else>
            !!invalid amount!!
        </slot>
    </span>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import { formatAmount } from 'src/utils/format'

export default defineComponent({
    props: {
        value: [Number, String, Object] as unknown as () => BigNumber.Value | null,
        decimals: Number,
        fixed: { // least length of decimal part
            type: Number,
            default: 2
        },
        long: Boolean // full precision
    },
    computed: {
        formatted() {
            // a missing value formats as invalid (null), as before
            return formatAmount(this.value ?? NaN, {
                unit: this.decimals,
                fixed: this.fixed,
                fullPrecision: this.long
            })
        }
    }
})
</script>
