<template>
    <div class="nft-chip row no-wrap items-center">
        <q-img
            v-if="nft && nft.image"
            :src="nft.image"
            :ratio="1"
            class="nft-chip-image"
        />
        <div
            v-else
            class="nft-chip-image flex flex-center"
        >
            <q-icon
                name="o_image"
                size="16px"
                class="text-muted"
            />
        </div>
        <div
            class="q-ml-sm ellipsis"
            style="min-width: 0"
        >{{nft ? nft.name : `${collectionName || ''} #${tokenId}`}}<template v-if="amount > 1n"> × {{amount.toString()}}</template></div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import type { BVM } from 'boot/services/bvm'

// an NFT by contract and id, with its picture and name when BlackVeMarket knows it
export default defineComponent({
    props: {
        gid: { type: String, required: true },
        contract: { type: String, required: true },
        tokenId: { type: String, required: true },
        amount: { type: BigInt as unknown as () => bigint, default: 1n },
        collectionName: String
    },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        nft: null as BVM.NFT | null
    }),
    asyncComputed: {
        async nft(): Promise<BVM.NFT | null> {
            if (!this.$svc.bvm.supports(this.gid)) {
                return null
            }
            try {
                return await this.$svc.bvm.nft(this.contract, this.tokenId)
            } catch {
                return null
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.nft-chip
  font-weight: 700
  min-width: 0

.nft-chip-image
  width: 32px
  height: 32px
  flex: none
  border-radius: 6px
  border: 1px solid $hairline
  background: rgba(255, 255, 255, 0.04)
</style>
