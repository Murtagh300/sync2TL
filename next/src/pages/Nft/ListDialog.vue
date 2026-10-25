<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{title}}</prompt-dialog-toolbar>
            <q-form @submit="onSubmit">
                <q-card-section>
                    <p class="text-soft q-mt-none">{{message}}</p>
                    <div class="row no-wrap q-gutter-x-sm">
                        <q-input
                            v-model="price"
                            class="col"
                            outlined
                            autofocus
                            inputmode="decimal"
                            placeholder="0.00"
                            input-class="bvm-display list-price"
                            :error="!!error"
                            :error-message="error"
                            no-error-icon
                        />
                        <q-select
                            v-model="symbol"
                            :options="currencies"
                            outlined
                            style="min-width: 110px"
                        />
                    </div>
                    <div
                        v-if="floor"
                        class="text-muted list-floor"
                    >{{$t('market.label_floor')}}: <span class="bvm-amount">{{floor}}</span></div>
                </q-card-section>
                <q-card-actions class="q-px-md q-pb-md">
                    <q-btn
                        class="full-width"
                        unelevated
                        no-caps
                        size="lg"
                        color="primary"
                        type="submit"
                        :label="action"
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
import { listingCurrencies } from 'src/utils/market'

export type ListResult = { price: string, symbol: string }

// a price and currency for listing one or more NFTs
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        title: { type: String, required: true },
        message: { type: String, default: '' },
        action: { type: String, required: true },
        floor: String,
        initialPrice: String,
        initialSymbol: String
    },
    data() {
        return {
            price: this.initialPrice || '',
            symbol: this.initialSymbol && this.initialSymbol in listingCurrencies ? this.initialSymbol : 'VET',
            error: ''
        }
    },
    computed: {
        currencies(): string[] {
            return Object.keys(listingCurrencies)
        }
    },
    watch: {
        price() { this.error = '' }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        onSubmit() {
            const price = this.price.trim().replace(',', '.')
            if (!/^\d+(\.\d{1,18})?$/.test(price) || parseFloat(price) <= 0) {
                this.error = this.$t('send.msg_invalid_amount')
                return
            }
            this.$emit('ok', { price, symbol: this.symbol } as ListResult)
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
:deep(.list-price)
  font-size: 28px !important

.list-floor
  font-size: 13px
</style>
