<template>
    <q-avatar v-bind="$attrs">
        <img
            :src="svg"
            alt=""
        >
    </q-avatar>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { picasso } from '@vechain/picasso'
export default defineComponent({
    props: {
        addr: String
    },
    computed: {
        svg(): string {
            return this.addr ? `data:image/svg+xml;utf8,${picasso(this.addr.toLowerCase())}` : ''
        }
    }
})
</script>
