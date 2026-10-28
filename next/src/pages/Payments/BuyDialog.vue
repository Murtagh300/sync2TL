<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{$t('buys.title_new')}}</prompt-dialog-toolbar>
            <q-card-section class="q-pt-none q-gutter-y-md">
                <q-btn-toggle
                    v-model="kind"
                    class="full-width kind-toggle"
                    spread
                    no-caps
                    unelevated
                    color="transparent"
                    text-color="grey-5"
                    toggle-color="primary"
                    toggle-text-color="dark"
                    :options="[{ value: 'repeat', label: $t('buys.kind_repeat') }, { value: 'limit', label: $t('buys.kind_limit') }]"
                />
                <div class="row no-wrap q-gutter-x-sm">
                    <q-input
                        v-model="amount"
                        class="col"
                        outlined
                        inputmode="decimal"
                        :label="$t('buys.label_pay')"
                        :error="!!amount && !validAmount"
                        no-error-icon
                        hide-bottom-space
                    />
                    <q-select
                        v-model="from"
                        :options="symbols"
                        outlined
                        style="min-width: 110px"
                    />
                </div>
                <q-select
                    v-model="to"
                    :options="symbols.filter(s => s !== from)"
                    outlined
                    :label="$t('buys.label_buy')"
                />
                <q-btn-toggle
                    v-if="kind === 'repeat'"
                    v-model="every"
                    class="full-width kind-toggle"
                    spread
                    no-caps
                    unelevated
                    color="transparent"
                    text-color="grey-5"
                    toggle-color="primary"
                    toggle-text-color="dark"
                    :options="[{ value: 'day', label: $t('buys.every_day') }, { value: 'week', label: $t('payments.every_week') }, { value: 'month', label: $t('payments.every_month') }]"
                />
                <q-input
                    v-else
                    v-model="below"
                    outlined
                    inputmode="decimal"
                    :label="$t('buys.label_below', { symbol: to, currency })"
                    :hint="now ? $t('buys.hint_now', { price: now }) : undefined"
                    :error="!!below && !validBelow"
                    no-error-icon
                />
                <p class="text-muted q-mb-none hint">{{$t('buys.msg_how')}}</p>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md">
                <q-btn
                    class="full-width"
                    unelevated
                    no-caps
                    color="primary"
                    :disable="!valid"
                    :label="$t('buys.action_save')"
                    @click="ok()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'

export type BuyDialogResult = { from: string, to: string, amount: string, every: 'day' | 'week' | 'month' | null, below: number | null }

const num = (v: string) => v.trim().replace(',', '.')

export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        symbols: { type: Array as () => string[], required: true },
        currency: { type: String, default: 'EUR' },
        /** the current price of a token in the currency, as text, for the limit hint */
        priceOf: { type: Function as unknown as () => (symbol: string) => string, default: () => '' }
    },
    data: (vm) => ({
        kind: 'repeat' as 'repeat' | 'limit',
        amount: '',
        from: 'VET',
        to: vm.symbols.includes('B3TR') ? 'B3TR' : (vm.symbols.find(s => s !== 'VET') || ''),
        every: 'week' as 'day' | 'week' | 'month',
        below: ''
    }),
    computed: {
        validAmount(): boolean {
            return /^\d+(\.\d+)?$/.test(num(this.amount)) && parseFloat(num(this.amount)) > 0
        },
        validBelow(): boolean {
            return /^\d+(\.\d+)?$/.test(num(this.below)) && parseFloat(num(this.below)) > 0
        },
        valid(): boolean {
            return this.validAmount && !!this.to && this.to !== this.from && (this.kind === 'repeat' || this.validBelow)
        },
        now(): string {
            return this.to ? this.priceOf(this.to) : ''
        }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        ok() {
            const r: BuyDialogResult = {
                from: this.from,
                to: this.to,
                amount: num(this.amount),
                every: this.kind === 'repeat' ? this.every : null,
                below: this.kind === 'limit' ? parseFloat(num(this.below)) : null
            }
            this.$emit('ok', r)
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
.kind-toggle
  border: 1px solid $hairline-2
  border-radius: $radius
  :deep(.q-btn)
    min-height: 36px
    font-weight: 700

.hint
  font-size: 13px
</style>
