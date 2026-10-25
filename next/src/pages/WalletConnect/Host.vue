<template>
    <span class="hidden" />
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import ProposalDialog from './ProposalDialog.vue'
import { initWalletConnect, shouldAutostart, type Handlers, type WcProposal } from 'src/utils/walletconnect'

/**
 * Answers WalletConnect while the app is open: connection proposals and requests go through
 * the wallet's own dialogs. Started with the app once WalletConnect was used.
 */
export default defineComponent({
    created() {
        if (shouldAutostart()) {
            void this.start()
        }
        window.addEventListener('bv-wc-start', this.start)
    },
    beforeUnmount() {
        window.removeEventListener('bv-wc-start', this.start)
    },
    methods: {
        handlers(): Handlers {
            return {
                approve: (p: WcProposal) => this.$dialog<{ gid: string, address: string }>({ component: ProposalDialog, proposal: p }),
                sendTransaction: (gid, req) => this.$signTx(gid, req),
                signCertificate: (gid, req) => this.$signCert(gid, req),
                notify: (url: string) => this.$q.notify({ message: this.$t('wc.msg_unverified', { url }), color: 'negative', icon: 'o_gpp_bad', timeout: 10000 })
            }
        },
        async start() {
            await initWalletConnect(this.handlers())
        }
    }
})
</script>
