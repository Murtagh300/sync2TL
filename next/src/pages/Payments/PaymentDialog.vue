<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{scheduled ? $t('payments.title_new_scheduled') : $t('payments.title_new_request')}}</prompt-dialog-toolbar>
            <q-form @submit="onSubmit">
                <q-card-section class="q-gutter-y-sm">
                    <q-input
                        v-if="scheduled"
                        v-model="to"
                        outlined
                        dense
                        autofocus
                        spellcheck="false"
                        :label="$t('contacts.label_address')"
                        :error="!!toError"
                        :error-message="toError"
                        no-error-icon
                    />
                    <div class="row no-wrap q-gutter-x-sm">
                        <q-input
                            v-model="amount"
                            class="col"
                            outlined
                            dense
                            inputmode="decimal"
                            :autofocus="!scheduled"
                            :label="$t('send.label_amount')"
                            :error="!!amountError"
                            :error-message="amountError"
                            no-error-icon
                        />
                        <q-select
                            v-model="symbol"
                            :options="symbols"
                            outlined
                            dense
                            style="min-width: 110px"
                        />
                    </div>
                    <q-select
                        v-if="scheduled"
                        v-model="every"
                        outlined
                        dense
                        emit-value
                        map-options
                        :options="[{ label: $t('payments.every_week'), value: 'week' }, { label: $t('payments.every_month'), value: 'month' }]"
                        :label="$t('payments.label_every')"
                    />
                    <q-input
                        v-model="note"
                        outlined
                        dense
                        maxlength="80"
                        :label="$t('payments.label_note')"
                    />
                </q-card-section>
                <q-card-actions class="q-px-md q-pb-md">
                    <q-btn
                        class="full-width"
                        unelevated
                        no-caps
                        color="primary"
                        type="submit"
                        :loading="busy"
                        :label="scheduled ? $t('payments.action_schedule') : $t('payments.action_create_request')"
                    />
                </q-card-actions>
            </q-form>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import { address } from 'thor-devkit'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'
import { isVetName, resolveVetName } from 'src/utils/names'

export type PaymentDialogResult = { to: string, amount: string, symbol: string, note: string, every: 'week' | 'month' }

// what to ask for, or what to pay regularly
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        scheduled: Boolean,
        symbols: { type: Array as () => string[], default: () => ['VET', 'VTHO'] }
    },
    data: () => ({
        to: '',
        amount: '',
        symbol: 'VET',
        note: '',
        every: 'month' as 'week' | 'month',
        toError: '',
        amountError: '',
        busy: false
    }),
    watch: {
        to() { this.toError = '' },
        amount() { this.amountError = '' }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        async onSubmit() {
            const amount = this.amount.trim().replace(',', '.')
            if (!/^\d+(\.\d+)?$/.test(amount) || parseFloat(amount) <= 0) {
                this.amountError = this.$t('send.msg_invalid_amount')
                return
            }
            let to = this.to.trim()
            if (this.scheduled) {
                if (isVetName(to)) {
                    this.busy = true
                    to = (await resolveVetName(to).catch(() => null)) || ''
                    this.busy = false
                    if (!to) {
                        this.toError = this.$t('send.msg_vet_not_found', { name: this.to.trim() })
                        return
                    }
                } else if (!address.test(to)) {
                    this.toError = this.$t('send.msg_invalid_address')
                    return
                }
            }
            this.$emit('ok', { to, amount, symbol: this.symbol, note: this.note.trim(), every: this.every } as PaymentDialogResult)
            this.hide()
        }
    }
})
</script>
