<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{$t('split.title')}}</prompt-dialog-toolbar>
            <q-form @submit="onSubmit">
                <q-card-section class="q-gutter-y-sm">
                    <div class="row no-wrap q-gutter-x-sm">
                        <q-input
                            v-model="total"
                            class="col"
                            outlined
                            dense
                            autofocus
                            inputmode="decimal"
                            :label="$t('split.label_total')"
                        />
                        <q-select
                            v-model="symbol"
                            :options="symbols"
                            outlined
                            dense
                            style="min-width: 100px"
                        />
                    </div>
                    <q-input
                        v-model="names"
                        outlined
                        dense
                        type="textarea"
                        autogrow
                        :label="$t('split.label_people')"
                        :hint="$t('split.hint_people')"
                    />
                    <q-input
                        v-model="note"
                        outlined
                        dense
                        maxlength="60"
                        :label="$t('payments.label_note')"
                    />
                    <div
                        v-if="shares.length"
                        class="bvm-tile q-pa-sm text-caption"
                    >
                        <div
                            v-for="(s, k) in shares"
                            :key="k"
                            class="row no-wrap"
                        >
                            <span class="ellipsis">{{people[k]}}</span>
                            <q-space />
                            <span class="bvm-amount">{{s}} {{symbol}}</span>
                        </div>
                        <div class="text-muted q-mt-xs">{{$t('split.msg_cents')}}</div>
                    </div>
                    <div
                        v-if="error"
                        class="text-negative text-caption"
                    >{{error}}</div>
                </q-card-section>
                <q-card-actions class="q-px-md q-pb-md">
                    <q-btn
                        class="full-width"
                        unelevated
                        no-caps
                        color="primary"
                        type="submit"
                        :disable="!shares.length"
                        :label="$t('split.action_create', { n: shares.length })"
                    />
                </q-card-actions>
            </q-form>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'
import { splitShares } from 'src/utils/split-bill'

export type SplitResult = { symbol: string, note: string, shares: { name: string, amount: string }[] }

// a total split over people, as one payment request each
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        symbols: { type: Array as () => string[], required: true }
    },
    data: (vm) => ({
        total: '',
        symbol: vm.symbols[0] || 'VET',
        names: '',
        note: '',
        error: ''
    }),
    computed: {
        /** names, one per line or comma; a number means that many people */
        people(): string[] {
            const raw = this.names.trim()
            if (/^\d+$/.test(raw)) {
                const n = Math.min(50, parseInt(raw))
                return Array.from({ length: n }, (_, k) => this.$t('split.person', { n: k + 1 }))
            }
            return raw.split(/[\n,]/).map(s => s.trim()).filter(Boolean).slice(0, 50)
        },
        shares(): string[] {
            return splitShares(this.total.replace(',', '.'), this.people.length)
        }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        onSubmit() {
            if (!this.shares.length) {
                this.error = this.$t('split.msg_invalid')
                return
            }
            this.$emit('ok', {
                symbol: this.symbol,
                note: this.note.trim(),
                shares: this.shares.map((amount, k) => ({ name: this.people[k]!, amount }))
            } as SplitResult)
            this.hide()
        }
    }
})
</script>
