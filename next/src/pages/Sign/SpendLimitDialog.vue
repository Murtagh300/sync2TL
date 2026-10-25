<template>
    <q-dialog
        ref="dialog"
        persistent
        @hide="$emit('hide')"
    >
        <q-card class="limit-card">
            <q-card-section class="text-center q-pt-lg">
                <q-icon
                    name="o_front_hand"
                    size="40px"
                    color="warning"
                />
                <h2 class="bvm-display limit-title">{{$t('spendLimit.title')}}</h2>
                <p class="text-soft">{{$t('spendLimit.msg', { amount, limit })}}</p>
                <p class="text-muted limit-hint q-mb-none">{{$t('spendLimit.hint')}}</p>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md column q-gutter-y-sm">
                <q-btn
                    class="full-width"
                    unelevated
                    no-caps
                    color="primary"
                    :label="$t('common.cancel')"
                    @click="hide()"
                />
                <q-btn
                    class="full-width"
                    flat
                    no-caps
                    :disable="left > 0"
                    :label="left > 0 ? $t('spendLimit.action_wait', { n: left }) : $t('spendLimit.action_continue')"
                    @click="ok()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import { haptic } from 'src/utils/prefs'

// a transaction over the spending limit: wait ten seconds before it can go on
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        amount: { type: String, required: true },
        limit: { type: String, required: true }
    },
    data: () => ({
        left: 10,
        timer: 0 as ReturnType<typeof setInterval> | 0
    }),
    mounted() {
        haptic('warning')
        this.timer = setInterval(() => {
            this.left = Math.max(0, this.left - 1)
            if (!this.left && this.timer) clearInterval(this.timer)
        }, 1000)
    },
    beforeUnmount() {
        this.timer && clearInterval(this.timer)
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        ok() {
            this.$emit('ok')
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
.limit-card
  width: min(420px, 100%)

.limit-title
  font-size: 24px
  margin: 10px 0 6px

.limit-hint
  font-size: 12px
</style>
