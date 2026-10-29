<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('signMsg.title')" />
        <page-content
            class="col"
            padding
        >
            <q-btn-toggle
                v-model="mode"
                spread
                no-caps
                unelevated
                toggle-color="primary"
                toggle-text-color="dark"
                class="q-mb-md"
                :options="[{ value: 'sign', label: $t('signMsg.tab_sign') }, { value: 'verify', label: $t('signMsg.tab_verify') }]"
            />

            <!-- sign: a certificate with your text -->
            <template v-if="mode === 'sign'">
                <p class="text-soft">{{$t('signMsg.msg_sign')}}</p>
                <q-select
                    v-if="addresses.length > 1"
                    v-model="signer"
                    :options="addresses"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('signMsg.label_signer')"
                    class="q-mb-sm"
                />
                <q-input
                    v-model="text"
                    outlined
                    autogrow
                    type="textarea"
                    maxlength="2000"
                    :label="$t('signMsg.label_text')"
                />
                <template v-if="signed">
                    <div class="text-weight-bold q-mt-md q-mb-xs">{{$t('signMsg.label_signed')}}</div>
                    <pre class="code">{{signed}}</pre>
                    <div class="row q-gutter-sm">
                        <q-btn
                            outline
                            no-caps
                            color="primary"
                            icon="o_content_copy"
                            :label="$t('common.copy')"
                            @click="copy(signed)"
                        />
                        <q-btn
                            v-if="canShare"
                            outline
                            no-caps
                            color="primary"
                            icon="o_share"
                            :label="$t('gift.action_share')"
                            @click="share()"
                        />
                    </div>
                </template>
            </template>

            <!-- verify: whose it is, and what it says -->
            <template v-else>
                <p class="text-soft">{{$t('signMsg.msg_verify')}}</p>
                <q-input
                    v-model="pasted"
                    outlined
                    autogrow
                    type="textarea"
                    :label="$t('signMsg.label_paste')"
                />
                <div
                    v-if="check"
                    class="bvm-tile q-pa-md q-mt-md"
                >
                    <div
                        class="row no-wrap items-center"
                        :class="check.ok ? 'text-primary' : 'text-negative'"
                    >
                        <q-icon
                            :name="check.ok ? 'o_verified' : 'o_gpp_bad'"
                            size="26px"
                        />
                        <div class="q-ml-sm text-weight-bold">{{check.ok ? $t('signMsg.ok') : $t('signMsg.bad')}}</div>
                    </div>
                    <template v-if="check.ok">
                        <div class="text-muted q-mt-sm">{{$t('signMsg.label_by')}}</div>
                        <address-label
                            :addr="check.signer"
                            full
                        />
                        <div
                            v-if="check.name"
                            class="text-soft"
                        >{{check.name}}</div>
                        <div class="text-muted q-mt-sm">{{$t('signMsg.label_says')}}</div>
                        <div class="said">{{check.text}}</div>
                        <div class="text-caption text-muted q-mt-sm">{{$t('signMsg.label_when', { when: check.when, domain: check.domain })}}</div>
                    </template>
                </div>
            </template>
        </page-content>
        <page-action v-if="mode === 'sign'">
            <q-btn
                unelevated
                no-caps
                color="primary"
                icon="o_draw"
                :disable="!text.trim() || !signer"
                :label="$t('signMsg.action_sign')"
                @click="sign()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import AddressLabel from 'components/AddressLabel.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { copyText } from 'src/utils/clipboard'
import { nameOf } from 'src/utils/names'
import { checkCertificate } from 'src/utils/cert-check'

// sign a text with an address (a VeChain certificate), or check one someone sent
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel },
    data: () => ({
        mode: 'sign' as 'sign' | 'verify',
        wallets: [] as M.Wallet[],
        signer: '',
        text: '',
        signed: '',
        pasted: '',
        canShare: typeof navigator !== 'undefined' && !!navigator.share
    }),
    computed: {
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id && canSign(w))
                .flatMap(w => w.meta.addresses.map((a, i) => ({ label: `${w.meta.name} #${i + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        check(): { ok: boolean, signer: string, text: string, when: string, domain: string, name: string } | null {
            if (!this.pasted.trim()) return null
            const c = checkCertificate(this.pasted)
            return {
                ...c,
                when: c.time ? new Date(c.time).toLocaleString(this.$i18n.locale) : '',
                name: c.ok ? nameOf(c.signer) : ''
            }
        }
    },
    watch: {
        text() { this.signed = '' },
        signer() { this.signed = '' }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id && canSign(x)))
        this.signer = w?.meta.addresses[0] || this.addresses[0]?.value || ''
    },
    methods: {
        async sign() {
            const message = { purpose: 'identification' as const, payload: { type: 'text' as const, content: this.text.trim() } }
            try {
                const resp = await this.$signCert(genesises.main.id, { message, options: { signer: this.signer }, domain: window.location.host, origin: window.location.origin })
                this.signed = JSON.stringify({ ...message, ...resp.annex, signature: resp.signature }, null, 1)
            } catch {
                // declined
            }
        },
        async copy(t: string) {
            await copyText(t)
            this.$q.notify(this.$t('common.copied'))
        },
        async share() {
            try {
                await navigator.share({ title: this.$t('signMsg.title'), text: this.signed })
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.code
  white-space: pre-wrap
  word-break: break-all
  font-size: 11px
  padding: 12px
  border-radius: 10px
  background: rgba(255, 255, 255, 0.04)
  max-height: 220px
  overflow: auto

.said
  white-space: pre-wrap
  word-break: break-word
  font-size: 15px
</style>
