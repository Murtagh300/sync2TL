<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('donate.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('donate.msg_intro')}}</p>
            <q-select
                v-if="addresses.length > 1"
                v-model="to"
                :options="addresses"
                emit-value
                map-options
                outlined
                dense
                :label="$t('invoice.label_paid_to')"
                class="q-mb-sm"
            />
            <q-input
                v-model="label"
                outlined
                dense
                maxlength="40"
                :label="$t('donate.label_text')"
                class="q-mb-sm"
            />
            <div class="row q-gutter-sm q-mb-sm">
                <q-chip
                    v-for="s in ['VET', 'B3TR']"
                    :key="s"
                    clickable
                    :outline="s !== symbol"
                    :color="s === symbol ? 'primary' : undefined"
                    :text-color="s === symbol ? 'dark' : undefined"
                    @click="symbol = s"
                >{{s}}</q-chip>
            </div>
            <q-input
                v-model="amount"
                outlined
                dense
                inputmode="decimal"
                :label="$t('donate.label_amount', { symbol })"
                :hint="$t('donate.hint_amount')"
                class="q-mb-md"
            />
            <q-btn-toggle
                v-model="look"
                spread
                no-caps
                unelevated
                class="q-mb-md"
                toggle-color="primary"
                toggle-text-color="dark"
                :options="[{ value: 'dark', label: $t('donate.look_dark') }, { value: 'light', label: $t('donate.look_light') }, { value: 'qr', label: $t('donate.look_qr') }]"
            />

            <div class="text-weight-bold q-mb-xs">{{$t('donate.label_preview')}}</div>
            <!-- the snippet is built from text alone (escaped) and the QR code from the link -->
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="preview q-mb-md" :class="look === 'light' ? 'preview--light' : ''" v-html="snippet"></div>

            <div class="text-weight-bold q-mb-xs">{{$t('donate.label_code')}}</div>
            <pre class="code">{{snippet}}</pre>
            <p class="text-caption text-muted">{{$t('donate.msg_how')}}</p>
        </page-content>
        <page-action>
            <q-btn
                unelevated
                no-caps
                color="primary"
                icon="o_content_copy"
                :disable="!to"
                :label="$t('donate.action_copy')"
                @click="copy()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import QRCode from 'qrcode-svg'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { copyText } from 'src/utils/clipboard'
import { buildPaymentLink } from 'src/utils/payment-request'

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// a donate or tip button for your own website: plain HTML, no script, opens BlackVault's send form
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction },
    data: () => ({
        wallets: [] as M.Wallet[],
        to: '',
        label: '',
        symbol: 'VET',
        amount: '',
        look: 'dark' as 'dark' | 'light' | 'qr'
    }),
    computed: {
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id)
                .flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        link(): string {
            if (!this.to) return ''
            const amount = /^\d+([.,]\d+)?$/.test(this.amount.trim()) ? this.amount.trim().replace(',', '.') : undefined
            return buildPaymentLink({ to: this.to, symbol: this.symbol, ...(amount ? { amount } : {}) })
        },
        text(): string {
            return this.label.trim() || this.$t('donate.default_text', { symbol: this.symbol })
        },
        snippet(): string {
            if (!this.link) return ''
            const href = esc(this.link)
            if (this.look === 'qr') {
                const svg = new QRCode({ content: this.link, container: 'svg-viewbox', join: true, padding: 1 }).svg()
                return `<a href="${href}" target="_blank" rel="noopener" style="display:inline-block;width:160px;background:#fff;padding:8px;border-radius:12px;text-decoration:none;color:#111;font:600 13px system-ui,sans-serif;text-align:center">${svg}<span style="display:block;margin-top:4px">${esc(this.text)}</span></a>`
            }
            const dark = this.look === 'dark'
            const style = `display:inline-block;padding:10px 18px;border-radius:999px;font:600 15px system-ui,sans-serif;text-decoration:none;background:${dark ? '#0b0b0c' : '#ffffff'};color:${dark ? '#6ee7b7' : '#0b0b0c'};border:1px solid ${dark ? '#6ee7b7' : '#0b0b0c'}`
            return `<a href="${href}" target="_blank" rel="noopener" style="${style}">${esc(this.text)}</a>`
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id))
        this.to = w?.meta.addresses[0] || this.addresses[0]?.value || ''
    },
    methods: {
        async copy() {
            await copyText(this.snippet)
            this.$q.notify(this.$t('common.copied'))
        }
    }
})
</script>
<style lang="sass" scoped>
.preview
  padding: 20px
  border-radius: 14px
  background: rgba(255, 255, 255, 0.04)
  text-align: center

.preview--light
  background: #f2f2f2

.code
  white-space: pre-wrap
  word-break: break-all
  font-size: 11px
  padding: 12px
  border-radius: 10px
  background: rgba(255, 255, 255, 0.04)
  max-height: 160px
  overflow: auto
</style>
