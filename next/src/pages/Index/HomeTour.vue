<template>
    <transition name="tour">
        <div
            v-if="step >= 0"
            class="tour"
            role="dialog"
            :aria-label="$t('tour.title')"
        >
            <div class="tour-card bvm-tile">
                <div class="row items-center no-wrap">
                    <q-icon
                        :name="steps[step]!.icon"
                        size="26px"
                        color="primary"
                    />
                    <div class="q-ml-sm text-muted tour-count">{{step + 1}} / {{steps.length}}</div>
                    <q-space />
                    <q-btn
                        flat
                        dense
                        no-caps
                        size="sm"
                        :label="$t('tour.action_skip')"
                        @click="done()"
                    />
                </div>
                <div class="bvm-display tour-title q-mt-sm">{{steps[step]!.title}}</div>
                <p class="text-soft q-mt-xs q-mb-md">{{steps[step]!.text}}</p>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    class="full-width"
                    :label="step === steps.length - 1 ? $t('tour.action_done') : $t('common.next')"
                    @click="next()"
                />
            </div>
        </div>
    </transition>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

const KEY = 'bv-tour-done'

// four cards after the first start: where things are
export default defineComponent({
    data: () => ({
        step: -1
    }),
    computed: {
        steps(): { icon: string, title: string, text: string }[] {
            return [
                { icon: 'o_show_chart', title: this.$t('tour.s1_title'), text: this.$t('tour.s1') },
                { icon: 'o_bolt', title: this.$t('tour.s2_title'), text: this.$t('tour.s2') },
                { icon: 'o_photo_library', title: this.$t('tour.s3_title'), text: this.$t('tour.s3') },
                { icon: 'o_shield', title: this.$t('tour.s4_title'), text: this.$t('tour.s4') }
            ]
        }
    },
    mounted() {
        try {
            if (!localStorage.getItem(KEY)) {
                setTimeout(() => { this.step = 0 }, 800)
            }
        } catch { }
    },
    methods: {
        next() {
            if (this.step < this.steps.length - 1) {
                this.step++
            } else {
                this.done()
            }
        },
        done() {
            this.step = -1
            try {
                localStorage.setItem(KEY, '1')
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.tour
  position: fixed
  inset: 0
  z-index: 3000
  display: flex
  align-items: flex-end
  justify-content: center
  padding: 16px 16px calc(84px + env(safe-area-inset-bottom))
  background: rgba(0, 0, 0, 0.55)

.tour-card
  width: 100%
  max-width: 420px
  padding: 16px
  background: $surface-2

.tour-title
  font-size: 22px

.tour-count
  font-size: 12px
  font-weight: 800

.tour-enter-active, .tour-leave-active
  transition: opacity 0.2s

.tour-enter-from, .tour-leave-to
  opacity: 0
</style>
