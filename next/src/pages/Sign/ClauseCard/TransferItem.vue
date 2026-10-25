<template>
    <div class="transfer q-px-md q-pb-md">
        <div class="row no-wrap items-center">
            <token-avatar
                :spec="op.token"
                size="28px"
                class="q-mr-sm"
            />
            <div class="transfer-amount bvm-display ellipsis">
                <amount-label
                    :value="op.amount"
                    :decimals="op.token.decimals"
                    long
                />
                <span class="transfer-symbol">{{op.token.symbol}}</span>
            </div>
        </div>
        <div class="transfer-to row no-wrap items-center q-mt-md">
            <q-icon
                name="o_south_east"
                size="18px"
                class="text-muted q-mr-sm"
            />
            <address-avatar
                v-if="op.to"
                :addr="op.to"
                size="20px"
                class="q-mr-sm"
            />
            <address-label
                class="ellipsis"
                :addr="op.to"
            >
                New Contract
            </address-label>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import TokenAvatar from 'src/components/TokenAvatar.vue'
import { BigNumber } from 'bignumber.js'
import AddressLabel from 'src/components/AddressLabel.vue'
import AmountLabel from 'src/components/AmountLabel.vue'
import AddressAvatar from 'src/components/AddressAvatar.vue'

export type OpTransfer = {
    type: 'transfer'
    token: M.TokenSpec
    amount: BigNumber
    to: string | null
}

export default defineComponent({
    components: { TokenAvatar, AddressLabel, AmountLabel, AddressAvatar },
    props: {
        op: { type: Object as () => OpTransfer, required: true }
    }
})
</script>
<style lang="sass" scoped>
.transfer-amount
  font-size: 32px

.transfer-symbol
  margin-left: 8px
  font-size: 16px
  font-weight: 800
  letter-spacing: 0
  color: $text-soft

.transfer-to
  padding-top: 12px
  border-top: 1px solid $hairline
  font-weight: 600
</style>
