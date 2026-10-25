<template>
    <div class="nft-op row no-wrap items-center q-px-md q-pb-md">
        <q-img
            v-if="nft && nft.image"
            :src="nft.image"
            :ratio="1"
            class="nft-op-image"
        />
        <div
            v-else
            class="nft-op-image nft-op-image--empty flex flex-center"
        >
            <q-icon
                name="o_image"
                size="22px"
                class="text-muted"
            />
        </div>
        <div
            class="col q-ml-md"
            style="min-width: 0"
        >
            <div class="nft-op-name ellipsis">{{nft ? nft.name : `#${op.tokenId}`}}</div>
            <div class="text-muted ellipsis nft-op-sub">
                {{nft ? nft.collection : ''}}
                <template v-if="op.amount && op.amount !== '1'">× {{op.amount}}</template>
            </div>
            <div class="row no-wrap items-center q-mt-xs">
                <q-icon
                    name="o_south_east"
                    size="16px"
                    class="text-muted q-mr-xs"
                />
                <address-label
                    class="ellipsis"
                    :addr="op.to"
                />
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import AddressLabel from 'src/components/AddressLabel.vue'
import type { BVM } from 'boot/services/bvm'

export type OpNft = {
    type: 'nft'
    contract: string
    tokenId: string
    to: string
    amount?: string
}

// an NFT leaving the wallet; BlackVeMarket supplies its picture and name when it knows it
export default defineComponent({
    components: { AddressLabel },
    props: {
        op: { type: Object as () => OpNft, required: true },
        gid: String
    },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        nft: null as BVM.NFT | null
    }),
    asyncComputed: {
        async nft(): Promise<BVM.NFT | null> {
            if (!this.gid || !this.$svc.bvm.supports(this.gid)) {
                return null
            }
            try {
                return await this.$svc.bvm.nft(this.op.contract, this.op.tokenId)
            } catch {
                return null
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.nft-op-image
  width: 64px
  height: 64px
  flex: none
  border-radius: 8px
  border: 1px solid $hairline
  background: rgba(255, 255, 255, 0.04)

.nft-op-name
  font-size: 16px
  font-weight: 900

.nft-op-sub
  font-size: 12px
</style>
