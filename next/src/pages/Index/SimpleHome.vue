<template>
    <div class="simple column">
        <portfolio-card
            :key="wallet.id"
            :wallet="wallet"
            :wallets="[wallet]"
            :scope="String(wallet.id)"
        />
        <div class="column q-gutter-y-md q-mt-lg">
            <q-btn
                v-if="canSign(wallet)"
                unelevated
                no-caps
                color="primary"
                class="big"
                icon="o_north_east"
                :label="$t('send.action_send')"
                @click="$router.push({ name: 'send', query: { wid: String(wallet.id), i: '0' } })"
            />
            <q-btn
                unelevated
                no-caps
                color="dark"
                text-color="primary"
                class="big big--soft"
                icon="o_south_west"
                :label="$t('address.action_receive')"
                @click="receive()"
            />
            <q-btn
                unelevated
                no-caps
                color="dark"
                text-color="white"
                class="big big--soft"
                icon="o_history"
                :label="$t('simple.action_history')"
                @click="$router.push({ name: 'activities' })"
            />
        </div>
        <q-btn
            flat
            no-caps
            class="q-mt-xl text-muted"
            icon="o_apps"
            :label="$t('simple.action_full')"
            @click="leave()"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PortfolioCard from './PortfolioCard.vue'
import ReceiveDialog from 'pages/Address/ReceiveDialog.vue'
import { canSign } from 'src/utils/watch'
import { prefs } from 'src/utils/prefs'

// the simple home: the balance and three big buttons, for beginners and anyone who wants calm
export default defineComponent({
    components: { PortfolioCard },
    props: {
        wallet: { type: Object as () => M.Wallet, required: true }
    },
    methods: {
        canSign,
        receive() {
            this.$dialog({ component: ReceiveDialog, address: this.wallet.meta.addresses[0] }).catch(() => { })
        },
        leave() {
            prefs.simpleMode = false
            this.$q.notify(this.$t('simple.msg_left'))
        }
    }
})
</script>
<style lang="sass" scoped>
.simple
  max-width: 480px
  margin: 0 auto
  padding-top: 8px

.big
  min-height: 72px
  font-size: 20px
  font-weight: 700
  border-radius: 18px

.big--soft
  border: 1px solid rgba(255, 255, 255, 0.1)
</style>
