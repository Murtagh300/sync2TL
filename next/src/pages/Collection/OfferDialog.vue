<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{title}}</prompt-dialog-toolbar>
            <q-form @submit="onSubmit">
                <q-card-section class="q-gutter-y-sm">
                    <p
                        v-if="message"
                        class="text-soft q-my-none"
                    >{{message}}</p>
                    <div class="row no-wrap q-gutter-x-sm">
                        <q-input
                            v-model="price"
                            class="col"
                            outlined
                            autofocus
                            inputmode="decimal"
                            placeholder="0.00"
                            input-class="bvm-display offer-price"
                            :label="collection ? $t('offers.label_each') : undefined"
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
                        v-if="symbol === 'VET'"
                        class="text-muted hint"
                    >{{$t('offers.msg_wrap')}}<help-tip term="vvet" /></div>
                    <template v-if="collection">
                        <div class="row no-wrap q-gutter-x-sm">
                            <q-input
                                v-model.number="quantity"
                                class="col"
                                outlined
                                dense
                                type="number"
                                min="1"
                                max="50"
                                :label="$t('offers.label_quantity')"
                            />
                            <q-select
                                v-model="days"
                                class="col"
                                outlined
                                dense
                                emit-value
                                map-options
                                :options="dayOptions"
                                :label="$t('offers.label_valid')"
                            />
                        </div>
                    </template>
                    <div
                        v-if="floor"
                        class="text-muted hint"
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
                        icon="o_local_offer"
                        :label="$t('offers.action_place')"
                    />
                </q-card-actions>
            </q-form>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import HelpTip from 'components/HelpTip.vue'
import { QDialog } from 'quasar'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'
import { offerCurrencies } from 'src/utils/market'

export type OfferResult = { price: string, symbol: string, quantity: number, days: number }

// a price for an offer on one NFT, or on any NFT(s) of a collection
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar, HelpTip },
    props: {
        title: { type: String, required: true },
        message: String,
        floor: String,
        /** an offer on the collection: also how many and for how long */
        collection: Boolean
    },
    data: () => ({
        price: '',
        symbol: 'VET',
        quantity: 1,
        days: 7,
        error: ''
    }),
    computed: {
        currencies(): string[] {
            return Object.keys(offerCurrencies)
        },
        dayOptions(): { label: string, value: number }[] {
            return [1, 7, 30, 90].map(d => ({ label: this.$t('offers.label_days', { n: d }), value: d }))
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
            const quantity = Math.max(1, Math.min(50, Math.floor(this.quantity || 1)))
            this.$emit('ok', { price, symbol: this.symbol, quantity, days: this.days } as OfferResult)
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
:deep(.offer-price)
  font-size: 26px !important

.hint
  font-size: 13px
</style>
