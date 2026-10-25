<template>
    <!-- the color and emoji the user gave a wallet; its address pattern when none -->
    <span
        v-if="wallet.meta.color || wallet.meta.emoji"
        class="wallet-mark flex flex-center"
        :style="{ width: size, height: size, background: background, fontSize: `calc(${size} * 0.55)` }"
        aria-hidden="true"
    >{{wallet.meta.emoji || initial}}</span>
    <address-avatar
        v-else
        :addr="wallet.meta.addresses[0]"
        :size="size"
    />
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import AddressAvatar from './AddressAvatar.vue'
import { walletColors } from 'src/utils/wallet-look'

export default defineComponent({
    components: { AddressAvatar },
    props: {
        wallet: { type: Object as () => M.Wallet, required: true },
        size: { type: String, default: '32px' }
    },
    computed: {
        background(): string {
            return walletColors[this.wallet.meta.color || ''] || 'rgba(255, 255, 255, 0.08)'
        },
        initial(): string {
            return (this.wallet.meta.name.trim()[0] || '•').toUpperCase()
        }
    }
})
</script>
<style lang="sass" scoped>
.wallet-mark
  flex: none
  border-radius: 30%
  color: #080a09
  font-weight: 900
  line-height: 1
</style>
