<template>
    <q-dialog
        ref="dialog"
        @hide="$emit('hide')"
        maximized
        transition-show="slide-up"
        transition-hide="slide-down"
    >
        <q-card class="column no-wrap">
            <page-toolbar
                :title="$t('common.certificate')"
                icon="close"
                :gid="gid"
                @action="hide()"
            />
            <page-content class="col q-pa-sm bg-page">
                <risk-card
                    :labels="siteRisks"
                    class="q-mb-sm"
                />
                <div class="text-uppercase">{{req.message.purpose}}</div>
                <q-card
                    flat
                    class="bg-surface-2"
                >
                    <div class="text-caption text-grey text-right q-px-xs">{{req.domain}}</div>
                    <q-card-section
                        class="serif"
                        style="min-height:300px;"
                    >
                        {{req.message.payload.content}}
                    </q-card-section>
                </q-card>
            </page-content>
            <page-content size="xs">
                <error-tip
                    v-if="criticalError"
                    :error="criticalError"
                />
                <signer-selector
                    v-else
                    :signer="signer"
                    :groups="signerGroups"
                    @select="signer=$event"
                />

            </page-content>
            <page-action class="q-mt-lg">
                <q-btn
                    v-if="criticalError"
                    outline
                    color="primary"
                    :label="$t('common.close')"
                    @click="hide()"
                />
                <q-btn
                    v-else
                    unelevated
                    color="primary"
                    :label="$t('sign.action_sign')"
                    @click="onClickSign()"
                />
            </page-action>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Common from './Common'
import { QDialog } from 'quasar'
import PageToolbar from 'src/components/PageToolbar.vue'
import PageContent from 'src/components/PageContent.vue'
import PageAction from 'src/components/PageAction.vue'
import SignerSelector from './SignerSelector.vue'
import { Certificate, blake2b256 } from 'thor-devkit'
import ErrorTip from './ErrorTip.vue'
import RiskCard from './RiskCard.vue'
import WarningListDialog from './WarningListDialog.vue'
import { siteLabels } from 'src/utils/phishing'
import type { RiskLabel } from 'src/utils/risk'

export default defineComponent({
    extends: Common,
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PageToolbar, PageContent, PageAction, SignerSelector, ErrorTip, RiskCard },
    props: {
        req: { type: Object as () => M.CertRequest, required: true }
    },
    data: () => ({
        /** a phishing site often asks to sign in first */
        siteRisks: [] as RiskLabel[]
    }),
    created() {
        void siteLabels(this.req.origin || (this.req.domain ? `https://${this.req.domain}` : '')).then(l => { this.siteRisks = l })
    },
    computed: {
        criticalError(): Error | null {
            if (!this.wallet) {
                return { name: this.$t('sign.label_critical_error').toString(), message: this.signerGroups.length > 0 ? this.$t('sign.msg_address_not_owned').toString() : this.$t('common.no_wallet').toString() }
            }
            return null
        }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },

        ok(result: M.CertResponse) {
            this.saveLastSigner()
            this.$emit('ok', result)
            this.hide()
        },
        async onClickSign() {
            const wallet = this.wallet
            if (!wallet) {
                return
            }

            const dangers = this.siteRisks.filter(r => r.level === 'danger')
            if (dangers.length) {
                try {
                    await this.$dialog({
                        component: WarningListDialog,
                        title: this.$t('risk.title_danger').toString(),
                        warnings: dangers.map(r => ({ name: this.$t(`risk.${r.key}`, r.params || {}).toString(), message: '' }))
                    })
                } catch {
                    return
                }
            }

            const req = this.req
            // build the cert (unsigned)
            const cert: Certificate = {
                ...req.message,
                // annex part
                signer: this.signer,
                timestamp: Math.round(Date.now() / 1000),
                domain: req.domain
            }

            const signature = '0x' + (await this.signCert(wallet, cert)).toString('hex')

            // here cert become signed
            cert.signature = signature
            const encoded = Certificate.encode(cert)

            this.$svc.activity.add({
                gid: this.gid,
                walletId: wallet.id,
                createdTime: Date.now(),
                status: 'completed',
                type: 'cert',
                glob: {
                    id: '0x' + blake2b256(encoded).toString('hex'),
                    encoded,
                    signer: cert.signer,
                    link: req.options.link || '',
                    origin: req.origin || ''
                }
            })
            this.ok({
                annex: {
                    domain: cert.domain,
                    signer: cert.signer,
                    timestamp: cert.timestamp
                },
                signature
            })
        }
    }
})
</script>
