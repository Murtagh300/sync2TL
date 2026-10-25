<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <q-card-section class="text-center q-pt-lg">
                <q-icon
                    :name="imitates ? 'o_gpp_bad' : 'o_person_search'"
                    size="40px"
                    :color="imitates ? 'negative' : 'warning'"
                />
                <template v-if="imitates">
                    <h2 class="bvm-display check-title text-negative">{{$t('recipientCheck.title_lookalike')}}</h2>
                    <p class="text-soft">{{$t('recipientCheck.message_lookalike')}}</p>
                    <div class="text-left text-muted check-label q-mt-md">{{$t('recipientCheck.label_sending_to')}}</div>
                </template>
                <template v-else>
                    <h2 class="bvm-display check-title">{{$t('recipientCheck.title')}}</h2>
                    <p class="text-soft">{{$t('recipientCheck.message')}}</p>
                </template>
                <div
                    class="bvm-tile check-address"
                    :class="imitates ? 'check-address--bad q-mt-xs' : 'q-mt-md'"
                >
                    <span class="check-edge">{{head}}</span><span class="check-middle">{{middle}}</span><span class="check-edge">{{tail}}</span>
                </div>
                <template v-if="imitates">
                    <div class="text-left text-muted check-label q-mt-sm">{{$t('recipientCheck.label_known')}}</div>
                    <div class="bvm-tile check-address q-mt-xs">
                        <span
                            v-for="(c, i) in knownChars"
                            :key="i"
                            :class="c.differs ? 'check-diff' : 'check-middle'"
                        >{{c.char}}</span>
                    </div>
                </template>
                <p
                    v-else
                    class="text-muted check-hint q-mt-sm q-mb-none"
                >{{$t('recipientCheck.hint')}}</p>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md column q-gutter-y-sm">
                <q-btn
                    class="full-width"
                    unelevated
                    no-caps
                    size="lg"
                    :color="imitates ? 'grey-9' : 'primary'"
                    :label="$t(imitates ? 'recipientCheck.action_continue_anyway' : 'recipientCheck.action_continue')"
                    @click="ok()"
                />
                <q-btn
                    class="full-width"
                    :flat="!imitates"
                    :unelevated="!!imitates"
                    :color="imitates ? 'primary' : undefined"
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
        to: { type: String, required: true },
        /** a known address this one imitates (same start and end) */
        imitates: { type: String as () => string | null, default: null }
    },
    computed: {
        checksumed(): string { return address.toChecksumed(this.to) },
        head(): string { return this.checksumed.slice(0, 6) },
        middle(): string { return this.checksumed.slice(6, -4) },
        tail(): string { return this.checksumed.slice(-4) },
        /** the known address, with the characters that differ from this one marked */
        knownChars(): { char: string, differs: boolean }[] {
            const known = this.imitates ? address.toChecksumed(this.imitates) : ''
            return [...known].map((char, i) => ({ char, differs: char.toLowerCase() !== (this.checksumed[i] || '').toLowerCase() }))
        }
    },
    mounted() {
        haptic(this.imitates ? 'error' : 'warning')
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

.check-label
  font-size: 12px
  font-weight: 700

.check-address--bad
  border-color: var(--q-negative)

.check-diff
  font-size: 13px
  font-weight: 900
  color: var(--q-negative)
</style>
