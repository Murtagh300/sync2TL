<template>
    <div class="relative-position bg-black">
        <video
            ref="vid"
            class="fit"
        />
        <div
            class="absolute-center"
            :style="scanRegionStyles"
        />
        <q-resize-observer
            @resize="size.w = $event.width;size.h = $event.height"
            :debounce="0"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent, markRaw } from 'vue'
import { QrScanner } from 'src/utils/qr-scanner'

// the native app scans with a Capacitor plugin instead (phase 6)
export default defineComponent({
    emits: ['input', 'error'],
    data: () => {
        return {
            size: { w: 0, h: 0 },
            scanner: null as QrScanner | null
        }
    },
    computed: {
        scanRegionStyles() {
            const { w, h } = this.size
            const x = Math.min(w, h) * 2 / 3
            return {
                border: '1px solid green',
                width: `${x}px`,
                height: `${x}px`
            }
        }
    },
    mounted() {
        const video = this.$refs.vid as HTMLVideoElement
        const scanner = markRaw(new QrScanner(
            video,
            result => {
                this.$emit('input', result.data)
            },
            {
                preferredCamera: 'environment',
                returnDetailedScanResult: true
            }
        ))
        this.scanner = scanner

        scanner.start().catch(err => {
            this.$emit('error', err)
        })
    },
    beforeUnmount() {
        this.scanner?.destroy()
    }
})
</script>
