<template>
    <div v-html="svg"></div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import QRCode from 'qrcode-svg'

// usage: <q-r-code>text to encode</q-r-code>
export default defineComponent({
    data() {
        return { content: '' }
    },
    methods: {
        extractSlot() {
            const first = this.$slots.default?.()[0]
            this.content = typeof first?.children === 'string' ? first.children : ''
        }
    },
    computed: {
        svg(): string {
            return new QRCode({
                content: this.content,
                container: 'svg-viewbox',
                join: true
            }).svg()
        }
    },
    created() {
        this.extractSlot()
    },
    beforeUpdate() {
        this.extractSlot()
    }
})
</script>
