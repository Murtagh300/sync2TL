<template>
    <div
        v-if="items.length || queued"
        class="resend q-mt-md"
    >
        <div class="resend-row row no-wrap">
            <q-chip
                v-if="queued"
                clickable
                color="primary"
                text-color="dark"
                icon="o_playlist_play"
                class="q-ml-none"
                :label="$t('queue.chip', { n: queued })"
                @click="$router.push({ name: 'send-queue', query: { wid: String(wallet.id), i: '0' } })"
            />
            <q-chip
                v-for="p in items"
                :key="p.address"
                clickable
                outline
                class="q-ml-none"
                :aria-label="$t('home.action_resend', { amount: `${p.amount} ${p.symbol}`, name: label(p.address) })"
                @click="again(p)"
            >
                <address-avatar
                    :addr="p.address"
                    class="q-mr-sm"
                />
                <span class="ellipsis resend-label">{{p.amount}} {{p.symbol}} · {{label(p.address)}}</span>
            </q-chip>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import AddressAvatar from 'components/AddressAvatar.vue'
import { recentPayments, type LastPayment } from 'src/utils/last-payments'
import { queueOf } from 'src/utils/send-queue'
import { nameOf } from 'src/utils/names'
import { haptic } from 'src/utils/prefs'

// "send again": the last three payments, one tap to the send page filled in
export default defineComponent({
    components: { AddressAvatar },
    props: {
        wallet: { type: Object as () => M.Wallet, required: true }
    },
    computed: {
        items(): (LastPayment & { address: string })[] {
            if (this.wallet.meta.type === 'watch') return []
            return recentPayments(3, this.wallet.meta.addresses)
        },
        queued(): number {
            return this.wallet.meta.type === 'watch' ? 0 : this.wallet.meta.addresses.reduce((n, a) => n + queueOf(this.wallet.gid, a).length, 0)
        }
    },
    methods: {
        label(a: string) {
            return nameOf(a) || `${a.slice(0, 6)}…${a.slice(-4)}`
        },
        again(p: LastPayment & { address: string }) {
            haptic()
            void this.$router.push({ name: 'send', query: { wid: String(this.wallet.id), i: '0', symbol: p.symbol, to: p.address, amount: p.amount } })
        }
    }
})
</script>
<style lang="sass" scoped>
.resend-row
  overflow-x: auto
  scrollbar-width: none
  gap: 6px

.resend-label
  max-width: 180px
</style>
