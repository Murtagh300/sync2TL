<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <q-card-section class="text-center q-pt-lg">
                <q-icon
                    name="o_person_search"
                    size="40px"
                    color="warning"
                />
                <h2 class="bvm-display check-title">{{$t('recipientCheck.title')}}</h2>
                <p class="text-soft">{{$t('recipientCheck.message')}}</p>
                <div class="bvm-tile check-address q-mt-md">
                    <span class="check-edge">{{head}}</span><span class="check-middle">{{middle}}</span><span class="check-edge">{{tail}}</span>
                </div>
                <p class="text-muted check-hint q-mt-sm q-mb-none">{{$t('recipientCheck.hint')}}</p>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md column q-gutter-y-sm">
                <q-btn
                    class="full-width"
                    unelevated
                    no-caps
                    size="lg"
                    color="primary"
                    :label="$t('recipientCheck.action_continue')"
                    @click="ok()"
                />
                <q-btn
                    class="full-width"
                    flat
                    no-caps
                    :label="$t('common.cancel')"
                    @click="hide()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import { address } from 'thor-devkit'
import { haptic } from 'src/utils/prefs'

/**
 * a first payment to an address: its start and end large, so a look-alike address
 * (address poisoning) stands out
 */
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        to: { type: String, required: true }
    },
    computed: {
        checksumed(): string { return address.toChecksumed(this.to) },
        head(): string { return this.checksumed.slice(0, 6) },
        middle(): string { return this.checksumed.slice(6, -4) },
        tail(): string { return this.checksumed.slice(-4) }
    },
    mounted() {
        haptic('warning')
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
.check-title
  font-size: 24px
  margin: 10px 0 4px

.check-address
  padding: 12px
  word-break: break-all
  font-variant-numeric: tabular-nums

.check-edge
  font-size: 22px
  font-weight: 900
  color: $text

.check-middle
  font-size: 13px
  color: $text-muted

.check-hint
  font-size: 12px
</style>
