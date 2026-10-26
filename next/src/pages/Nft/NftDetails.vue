<template>
    <div>
        <div class="bvm-label q-mb-sm">{{$t('nft.label_details')}}</div>
        <div class="bvm-tile details">
            <div
                v-if="pnl"
                class="detail row no-wrap items-center"
            >
                <span class="text-muted">{{pnl.minted ? $t('nft.label_minted') : $t('nft.label_bought_for')}}</span>
                <q-space />
                <span class="bvm-amount">
                    <template v-if="!pnl.minted">{{pnl.paid}} {{pnl.currency}}</template>
                    <span
                        v-if="pnl.percent !== null"
                        class="q-ml-sm pnl"
                        :class="pnl.percent >= 0 ? 'text-primary' : 'text-negative'"
                    >{{pnl.percent >= 0 ? '+' : ''}}{{pnl.percent.toFixed(0)}}% {{$t('nft.label_vs_floor')}}</span>
                </span>
            </div>
            <div
                v-if="lastSale"
                class="detail row"
            >
                <span class="text-muted">{{$t('nft.label_last_sale')}}</span>
                <span class="q-ml-auto bvm-amount">{{lastSale.displayPrice}} {{lastSale.currency}}</span>
            </div>
            <div class="detail row no-wrap">
                <span class="text-muted">{{$t('nft.label_contract')}}</span>
                <address-label
                    class="q-ml-auto"
                    :addr="nft.contract"
                />
            </div>
            <div class="detail row">
                <span class="text-muted">{{$t('nft.label_token_id')}}</span>
                <span class="q-ml-auto text-weight-bold">{{nft.tokenId}}</span>
            </div>
            <div class="detail row">
                <span class="text-muted">{{$t('nft.label_standard')}}</span>
                <span class="q-ml-auto text-weight-bold text-uppercase">{{nft.tokenStandard}}</span>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { BVM } from 'boot/services/bvm'
import AddressLabel from 'components/AddressLabel.vue'

export type NftPnl = { paid: string, currency: string, minted: boolean, percent: number | null }

// what you paid, the last sale, and the NFT's contract, id and standard
export default defineComponent({
    components: { AddressLabel },
    props: {
        nft: { type: Object as PropType<BVM.NFT>, required: true },
        pnl: { type: Object as PropType<NftPnl | null>, default: null },
        lastSale: { type: Object as PropType<{ displayPrice: string, currency: string } | null>, default: null }
    }
})
</script>
<style lang="sass" scoped>
.pnl
  font-size: 13px

.details
  padding: 4px 14px

.detail
  padding: 10px 0
  font-size: 14px
  & + .detail
    border-top: 1px solid $hairline
</style>
