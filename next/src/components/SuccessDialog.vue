<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width success">
            <q-card-section class="text-center q-pt-xl">
                <div
                    v-if="image"
                    class="success-image q-mx-auto"
                >
                    <img
                        :src="image"
                        alt=""
                    >
                    <div class="success-badge flex flex-center">
                        <q-icon
                            name="check"
                            size="18px"
                        />
                    </div>
                </div>
                <svg
                    v-else
                    class="success-check q-mx-auto"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                >
                    <circle
                        cx="26"
                        cy="26"
                        r="24"
                    />
                    <path d="M15 27 l8 8 l15 -17" />
                </svg>
                <h2 class="bvm-display success-title">{{title}}</h2>
                <p
                    v-if="message"
                    class="text-soft q-mb-none"
                >{{message}}</p>
                <div
                    v-if="lines && lines.length"
                    class="success-lines bvm-tile q-mt-md text-left"
                >
                    <div
                        v-for="(l, i) in lines"
                        :key="i"
                        class="row no-wrap"
                    >
                        <span class="text-muted">{{l.label}}</span>
                        <q-space />
                        <span class="text-weight-bold bvm-amount">{{l.value}}</span>
                    </div>
                </div>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md column q-gutter-y-sm">
                <q-btn
                    v-if="link"
                    class="full-width"
                    outline
                    no-caps
                    color="primary"
                    icon-right="o_open_in_new"
                    :label="link.label"
                    @click="openURL(link.url)"
                />
                <q-btn
                    class="full-width"
                    unelevated
                    no-caps
                    size="lg"
                    color="primary"
                    :label="$t('common.finish')"
                    @click="hide()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import { openURL } from 'src/utils/open-url'
import { haptic } from 'src/utils/prefs'

export type SuccessOptions = {
    title: string
    message?: string
    image?: string
    lines?: { label: string, value: string }[]
    link?: { label: string, url: string }
}

// what just happened, after signing: a check (or the NFT), the numbers, and where to look
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        title: { type: String, required: true },
        message: String,
        image: String,
        lines: Array as () => SuccessOptions['lines'],
        link: Object as () => SuccessOptions['link']
    },
    mounted() {
        haptic('success')
    },
    methods: {
        openURL,
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() }
    }
})
</script>
<style lang="sass" scoped>
.success-title
  font-size: 28px
  margin: 18px 0 6px

.success-check
  display: block
  width: 76px
  height: 76px
  circle
    fill: var(--bv-accent-soft, color-mix(in srgb, var(--q-primary) 10%, transparent))
    stroke: var(--q-primary)
    stroke-width: 2
  path
    fill: none
    stroke: var(--q-primary)
    stroke-width: 4
    stroke-linecap: round
    stroke-linejoin: round
    stroke-dasharray: 40
    stroke-dashoffset: 40
    animation: draw 0.45s 0.15s ease-out forwards

@keyframes draw
  to
    stroke-dashoffset: 0

.success-image
  position: relative
  width: 120px
  height: 120px
  img
    width: 100%
    height: 100%
    object-fit: cover
    border-radius: $radius-lg
    border: 1px solid $hairline-2
    animation: pop 0.35s ease-out

@keyframes pop
  from
    transform: scale(0.85)
    opacity: 0

.success-badge
  position: absolute
  right: -8px
  bottom: -8px
  width: 32px
  height: 32px
  border-radius: 50%
  background: var(--q-primary)
  color: $on-primary
  border: 3px solid $surface-2

.success-lines
  padding: 10px 14px
  font-size: 14px
  > div + div
    margin-top: 6px
</style>
