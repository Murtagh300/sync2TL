<template>
    <q-dialog
        ref="dialog"
        @hide="$emit('hide')"
        maximized
        transition-show="slide-up"
        transition-hide="slide-down"
        @show="onShow()"
    >
        <div class="fit overflow-hidden">
            <q-btn
                :aria-label="$t('common.close')"
                size="lg"
                class="q-ml-md float-left"
                style="z-index: 1111"
                flat
                dense
                round
                icon="close"
                text-color="white" @click="hide()" />
            <Scanner
                v-if="!cameraError"
                class="fit"
                @input="onScanned"
                @error="onError"
            />
            <div
                v-else
                class="fit flex flex-center column text-center q-pa-lg bg-black text-white"
            >
                <q-icon
                    name="o_no_photography"
                    size="40px"
                />
                <div class="q-mt-sm">{{$t('scanner.msg_no_camera')}}</div>
            </div>
            <!-- a QR code in a screenshot or photo -->
            <q-btn
                class="scan-image"
                unelevated
                rounded
                no-caps
                color="dark"
                text-color="white"
                icon="o_image"
                :loading="reading"
                :label="$t('scanner.action_image')"
                @click="($refs.file as HTMLInputElement).click()"
            />
            <input
                ref="file"
                type="file"
                accept="image/*"
                class="hidden"
                @change="fromImage"
            >
        </div>
    </q-dialog>
</template>
<script lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineComponent } from 'vue'
import Scanner from './Scanner.vue'
import { QDialog } from 'quasar'
import { QrScanner } from 'src/utils/qr-scanner'

export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { Scanner },
    data: () => ({
        cameraError: false,
        reading: false
    }),
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        ok(result: unknown) {
            this.$emit('ok', result)
            this.hide()
        },
        onScanned(code: string) {
            this.ok(code)
        },
        onError(err: Error) {
            // no camera (desktop) or no permission: an image still works
            console.warn(err)
            this.cameraError = true
        },
        async fromImage(e: Event) {
            const input = e.target as HTMLInputElement
            const file = input.files?.[0]
            input.value = ''
            if (!file) {
                return
            }
            this.reading = true
            try {
                const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
                this.ok(result.data)
            } catch {
                this.$q.notify({ message: this.$t('scanner.msg_no_code'), color: 'negative' })
            } finally {
                this.reading = false
            }
        },
        onShow() {
            // make the backdrop invisible
            // don't use 'seamless' style here, since the dialog will not respond to back button if so
            // (the dialog is teleported to body, so look it up from its content, not this.$el)
            const content = (this.$refs.dialog as QDialog).contentEl as HTMLElement | undefined
            const backdrop = content?.parentElement?.querySelector('.q-dialog__backdrop')
            backdrop && backdrop.classList.add('invisible')
        }
    }
})
</script>
<style lang="sass" scoped>
.scan-image
  position: absolute
  left: 50%
  bottom: calc(32px + env(safe-area-inset-bottom))
  transform: translateX(-50%)
  z-index: 1111
  border: 1px solid rgba(255, 255, 255, 0.25)
</style>
