<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{$t('alerts.title_add')}}</prompt-dialog-toolbar>
            <q-form @submit="onSubmit">
                <q-card-section>
                    <div class="text-weight-bold">{{collection.name}}</div>
                    <div
                        v-if="collection.floorValue != null"
                        class="text-muted q-mb-md"
                    >{{$t('market.label_floor')}}: {{collection.floorValue}} {{collection.floorCurrency}}</div>
                    <q-btn-toggle
                        v-model="kind"
                        spread
                        no-caps
                        unelevated
                        toggle-color="primary"
                        color="dark"
                        class="q-mb-md"
                        :options="[
                            { label: $t('alerts.label_below'), value: 'below' },
                            { label: $t('alerts.label_above'), value: 'above' }
                        ]"
                    />
                    <q-input
                        v-model="value"
                        outlined
                        autofocus
                        inputmode="decimal"
                        :suffix="currency"
                        :error="!!error"
                        :error-message="error"
                        no-error-icon
                    />
                </q-card-section>
                <q-card-actions class="q-px-md q-pb-md">
                    <q-btn
                        class="full-width"
                        unelevated
                        no-caps
                        color="primary"
                        type="submit"
                        :label="$t('alerts.action_save')"
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
import type { BVM } from 'boot/services/bvm'
import type { AlertRule } from 'src/utils/alerts'

// a floor price alert for a collection
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        collection: { type: Object as () => BVM.Collection, required: true }
    },
    data() {
        return {
            kind: 'below' as AlertRule['kind'],
            value: this.collection.floorValue != null ? String(this.collection.floorValue) : '',
            error: ''
        }
    },
    computed: {
        currency(): string {
            return this.collection.floorCurrency || 'VET'
        }
    },
    watch: {
        value() { this.error = '' }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        onSubmit() {
            const v = parseFloat(this.value.replace(',', '.'))
            if (!isFinite(v) || v <= 0) {
                this.error = this.$t('send.msg_invalid_amount')
                return
            }
            const rule: AlertRule = {
                id: `${this.collection.slug}:${Date.now()}`,
                slug: this.collection.slug,
                name: this.collection.name,
                kind: this.kind,
                value: v,
                currency: this.currency
            }
            this.$emit('ok', rule)
            this.hide()
        }
    }
})
</script>
