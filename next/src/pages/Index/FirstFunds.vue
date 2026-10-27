<template>
    <!-- a wallet with nothing on it yet: how to get the first VET there -->
    <div
        v-if="empty"
        class="bvm-tile first-funds q-pa-md q-mt-lg"
    >
        <div class="row no-wrap items-center q-mb-sm">
            <q-icon
                name="o_south_west"
                size="22px"
                color="primary"
                class="q-mr-sm"
            />
            <div class="text-weight-bold first-funds-title">{{$t('firstFunds.title')}}</div>
        </div>
        <p class="text-soft q-mb-md first-funds-msg">{{$t('firstFunds.msg')}}</p>
        <div class="row no-wrap q-gutter-x-sm">
            <q-btn
                class="col"
                unelevated
                no-caps
                color="primary"
                icon="o_qr_code_2"
                :label="$t('firstFunds.action_receive')"
                @click="receive()"
            />
            <q-btn
                class="col"
                outline
                no-caps
                color="primary"
                icon="o_content_copy"
                :label="$t('firstFunds.action_copy')"
                @click="copy()"
            />
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address as addr } from 'thor-devkit'
import { genesises } from 'src/consts'
import { copyText } from 'src/utils/clipboard'
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
    computed: {
        first(): string {
            return this.wallet.meta.addresses[0] || ''
        }
    },
    methods: {
        receive() {
            this.$dialog({ component: ReceiveDialog, address: this.first }).catch(() => { })
        },
        copy() {
            copyText(addr.toChecksumed(this.first))
                .then(() => this.$q.notify(this.$t('common.copied')))
                .catch(console.error)
        }
    }
})
</script>
<style lang="sass" scoped>
.first-funds
  border-color: color-mix(in srgb, var(--q-primary) 35%, transparent)

.first-funds-title
  font-size: 16px

.first-funds-msg
  font-size: 13px
  line-height: 1.45
</style>
