<template>
    <!-- a wallet with nothing on it yet: one slim row on how to get the first VET there -->
    <div
        v-if="empty"
        class="bvm-tile first-funds row no-wrap items-center"
    >
        <q-icon
            name="o_south_west"
            size="20px"
            color="primary"
            class="q-mr-sm"
        />
        <div class="col">
            <div class="first-funds-title">{{$t('firstFunds.title')}}</div>
            <div class="text-muted first-funds-msg">{{$t('firstFunds.msg_short')}}</div>
        </div>
        <q-btn
            unelevated
            dense
            no-caps
            color="primary"
            class="q-px-md first-funds-btn"
            :label="$t('firstFunds.action_receive')"
            @click="receive()"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { genesises } from 'src/consts'
import ReceiveDialog from 'pages/Address/ReceiveDialog.vue'

export default defineComponent({
    props: {
        wallet: { type: Object as () => M.Wallet, required: true }
    },
    data: () => ({
        empty: false
    }),
    async created() {
        // mainnet only: a test network has its own faucets
        if (this.wallet.gid !== genesises.main.id) return
        try {
            const thor = this.$svc.bc(this.wallet.gid).thor
            const accounts = await Promise.all(this.wallet.meta.addresses.map(a => thor.account(a).get()))
            // VET and VTHO both zero; a token-only address is rare and still shows its tokens
            this.empty = accounts.every(a => BigInt(a.balance) === 0n && BigInt(a.energy) === 0n)
        } catch {
            // offline: say nothing
        }
    },
    methods: {
        // the receive sheet has the QR code, copying and the VeChain-only note
        receive() {
            this.$dialog({ component: ReceiveDialog, address: this.wallet.meta.addresses[0] || '' }).catch(() => { })
        }
    }
})
</script>
<style lang="sass" scoped>
.first-funds
  padding: 8px 8px 8px 14px
  border-color: color-mix(in srgb, var(--q-primary) 35%, transparent)

.first-funds-title
  font-size: 13px
  font-weight: 800
  line-height: 1.3

.first-funds-msg
  font-size: 12px
  line-height: 1.3

.first-funds-btn
  min-height: 32px
</style>
