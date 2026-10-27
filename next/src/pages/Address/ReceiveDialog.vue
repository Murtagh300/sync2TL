<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width receive">
            <prompt-dialog-toolbar>{{$t('address.action_receive')}}</prompt-dialog-toolbar>
            <q-card-section class="q-pt-none">
                <div class="qr-frame q-mx-auto">
                    <q-responsive :ratio="1">
                        <q-r-code class="full-width">{{content}}</q-r-code>
                    </q-responsive>
                </div>
                <div
                    v-if="request && amount"
                    class="text-center bvm-display receive-amount q-mt-md"
                >{{amount}} {{symbol}}</div>
                <!-- in blocks of four, to compare with what the sender sees -->
                <div
                    class="text-center receive-address q-mt-sm"
                    :aria-label="checksumed"
                >
                    <span
                        v-for="(g, n) in groups"
                        :key="n"
                        class="receive-group"
                    >{{g}}</span>
                </div>
                <div class="receive-network row no-wrap items-start q-mt-md">
                    <q-icon
                        name="o_info"
                        size="18px"
                        class="q-mr-sm"
                    />
                    <span>{{$t('receive.msg_network')}}</span>
                </div>

                <q-toggle
                    v-model="request"
                    class="q-mt-md"
                    color="primary"
                    :label="$t('receive.label_request')"
                />
                <div
                    v-if="request"
                    class="row no-wrap q-gutter-sm q-mt-xs"
                >
                    <q-input
                        v-model="amount"
                        class="col"
                        dense
                        outlined
                        inputmode="decimal"
                        placeholder="0.00"
                        :error="!!amount && !validAmount"
                        no-error-icon
                        hide-bottom-space
                    />
                    <q-select
                        v-model="symbol"
                        :options="symbols"
                        dense
                        outlined
                        style="min-width: 110px"
                    />
                </div>
                <p
                    v-if="request"
                    class="text-muted q-mt-sm q-mb-none receive-hint"
                >{{$t('receive.msg_request_hint')}}</p>
            </q-card-section>
            <q-card-actions class="row no-wrap q-px-md q-pb-md">
                <q-btn
                    class="col"
                    outline
                    no-caps
                    color="primary"
                    icon="o_image"
                    :label="$t('share.action_image')"
                    @click="shareImage()"
                />
                <q-btn
                    v-if="canShare"
                    class="col"
                    outline
                    no-caps
                    color="primary"
                    icon="o_ios_share"
                    :label="$t('receive.action_share')"
                    @click="share()"
                />
                <q-btn
                    class="col"
                    unelevated
                    no-caps
                    color="primary"
                    icon="o_content_copy"
                    :label="$t('common.copy')"
                    @click="copy()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import { address } from 'thor-devkit'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'
import QRCode from 'src/components/QRCode.vue'
import { copyText } from 'src/utils/clipboard'
import { buildPaymentLink } from 'src/utils/payment-request'
import { shareCard } from 'src/utils/share-card'
import { nameOf } from 'src/utils/names'

// the address as a QR code; with an amount it becomes a payment request
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar, QRCode },
    props: {
        address: { type: String, required: true },
        symbols: { type: Array as () => string[], default: () => ['VET', 'VTHO'] }
    },
    data: () => ({
        request: false,
        amount: '',
        symbol: 'VET'
    }),
    computed: {
        checksumed(): string {
            return address.toChecksumed(this.address)
        },
        /** 0xC107 3c63 6B84 … */
        groups(): string[] {
            const hex = this.checksumed.slice(2)
            const out = []
            for (let i = 0; i < hex.length; i += 4) out.push((i ? '' : '0x') + hex.slice(i, i + 4))
            return out
        },
        /** a comma for decimals is fine too */
        plainAmount(): string {
            return this.amount.trim().replace(',', '.')
        },
        validAmount(): boolean {
            return /^\d+(\.\d+)?$/.test(this.plainAmount) && parseFloat(this.plainAmount) > 0
        },
        /** what the QR code holds: the bare address, or a payment link */
        content(): string {
            if (this.request && this.validAmount) {
                return buildPaymentLink({ to: this.address, amount: this.plainAmount, symbol: this.symbol })
            }
            return this.checksumed
        },
        canShare(): boolean {
            return typeof navigator.share === 'function'
        }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        copy() {
            copyText(this.content)
                .then(() => this.$q.notify(this.$t('common.copied')))
                .catch(console.error)
        },
        shareImage() {
            const name = nameOf(this.address)
            shareCard({
                title: this.request && this.validAmount ? `${this.amount} ${this.symbol}` : (name || this.$t('share.my_wallet')),
                subtitle: `${this.checksumed.slice(0, 10)}…${this.checksumed.slice(-8)}`,
                qr: this.content
            }).catch(() => { })
        },
        share() {
            const text = this.request && this.validAmount
                ? this.$t('receive.msg_share_request', { amount: this.amount, symbol: this.symbol })
                : this.checksumed
            navigator.share({ title: 'BlackVault', text, url: this.content.startsWith('http') ? this.content : undefined })
                .catch(() => { /* closed */ })
        }
    }
})
</script>
<style lang="sass" scoped>
.qr-frame
  max-width: 232px
  padding: 12px
  border-radius: $radius-lg
  background: #fff

.receive-amount
  font-size: 28px

.receive-address
  font-size: 14px
  font-variant-numeric: tabular-nums
  line-height: 1.7
  max-width: 300px
  margin-left: auto
  margin-right: auto

.receive-group
  display: inline-block
  margin: 0 4px
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
  letter-spacing: 0.02em

.receive-network
  padding: 10px 12px
  border-radius: 12px
  background: rgba(252, 211, 77, 0.08)
  color: $warning
  font-size: 12px
  line-height: 1.4

.receive-hint
  font-size: 12px
</style>
