<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{$t('buyVet.title')}}</prompt-dialog-toolbar>
            <q-card-section class="q-pt-none">
                <!-- with a card or iDEAL: vechain.energy's ramp, straight to this address -->
                <div class="bvm-tile option q-pa-md">
                    <div class="row no-wrap items-center">
                        <q-icon
                            name="o_credit_card"
                            size="24px"
                            color="primary"
                            class="q-mr-md"
                        />
                        <div class="col">
                            <div class="text-weight-bold">{{$t('buyVet.title_ramp')}}</div>
                            <div class="text-muted option-msg">{{$t('buyVet.msg_ramp')}}</div>
                        </div>
                    </div>
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        icon-right="o_open_in_new"
                        class="full-width q-mt-md"
                        :label="$t('buyVet.action_ramp')"
                        @click="openRamp()"
                    />
                </div>

                <!-- at an exchange, then withdraw to this address on the VeChain network -->
                <div class="bvm-label q-mt-lg q-mb-sm">{{$t('buyVet.title_exchange')}}</div>
                <q-list class="bvm-list">
                    <q-item
                        v-for="x in exchanges"
                        :key="x.name"
                        clickable
                        @click="openURL(x.url)"
                    >
                        <q-item-section>
                            <q-item-label>{{x.name}}</q-item-label>
                            <q-item-label caption>{{x.note}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-icon name="o_open_in_new" />
                        </q-item-section>
                    </q-item>
                </q-list>
                <ol class="steps text-muted q-mt-md q-mb-none">
                    <li>{{$t('buyVet.step_buy')}}</li>
                    <li>{{$t('buyVet.step_withdraw')}}</li>
                    <li>
                        {{$t('buyVet.step_address')}}
                        <q-btn
                            flat
                            dense
                            no-caps
                            color="primary"
                            icon="o_content_copy"
                            class="q-px-xs"
                            :label="`${address.slice(0, 6)}…${address.slice(-4)}`"
                            @click="copy()"
                        />
                    </li>
                </ol>
                <p class="text-caption text-muted q-mt-md q-mb-none">{{$t('buyVet.msg_third_party')}}</p>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import { address as addressUtil } from 'thor-devkit'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'
import { copyText } from 'src/utils/clipboard'
import { openURL } from 'src/utils/open-url'

export const RAMP_URL = 'https://ramp.vechain.energy/'

export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        address: { type: String, required: true }
    },
    computed: {
        exchanges(): { name: string, url: string, note: string }[] {
            return [
                { name: 'Bitvavo', url: 'https://bitvavo.com/', note: this.$t('buyVet.note_bitvavo') },
                { name: 'Coinbase', url: 'https://www.coinbase.com/', note: this.$t('buyVet.note_global') },
                { name: 'Binance', url: 'https://www.binance.com/', note: this.$t('buyVet.note_global') },
                { name: 'Crypto.com', url: 'https://crypto.com/', note: this.$t('buyVet.note_global') }
            ]
        }
    },
    methods: {
        openURL,
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        async copy() {
            await copyText(addressUtil.toChecksumed(this.address)).catch(() => { })
            this.$q.notify(this.$t('common.copied'))
        },
        /** the ramp doesn't take the address from a link: it goes on the clipboard, to paste there */
        async openRamp() {
            await copyText(addressUtil.toChecksumed(this.address)).catch(() => { })
            this.$q.notify({ message: this.$t('buyVet.msg_address_copied'), timeout: 8000 })
            openURL(RAMP_URL)
        }
    }
})
</script>
<style lang="sass" scoped>
.option-msg
  font-size: 13px
  margin-top: 2px

.steps
  padding-left: 20px
  font-size: 13px
  li + li
    margin-top: 4px
</style>
