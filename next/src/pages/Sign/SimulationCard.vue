<template>
    <div class="bvm-tile simulation q-pa-md">
        <div class="bvm-label q-mb-sm">{{$t('sign.label_simulation')}}</div>
        <div
            v-if="rows.length === 0"
            class="text-muted"
        >{{$t('sign.msg_no_balance_change')}}</div>
        <div
            v-for="(row, i) in shownRows"
            :key="i"
            class="sim-row row no-wrap items-center"
        >
            <div
                class="sim-sign flex flex-center"
                :class="row.direction === 'in' ? 'sim-sign--in' : 'sim-sign--out'"
            >
                <q-icon
                    :name="row.direction === 'in' ? 'south_west' : 'north_east'"
                    size="14px"
                />
            </div>
            <div
                class="col q-ml-sm"
                style="min-width: 0"
            >
                <nft-chip
                    v-if="row.nft"
                    :gid="gid"
                    :contract="row.nft.contract"
                    :token-id="row.nft.tokenId"
                    :amount="row.nft.amount"
                    :collection-name="collections[row.nft.contract]?.name"
                />
                <span
                    v-else
                    class="sim-amount bvm-amount"
                >{{row.direction === 'in' ? '+' : '−'}}{{row.text}}</span>
            </div>
        </div>
        <div
            v-if="rows.length > shownRows.length"
            class="text-muted q-mt-xs"
        >{{$t('sign.msg_more_changes', { n: rows.length - shownRows.length })}}</div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import type { BalanceChanges, NftChange } from 'src/utils/simulate'
import { formatUnits } from 'src/utils/format'
import NftChip from './NftChip.vue'

type Row = { direction: 'in' | 'out', text?: string, nft?: NftChange }

// what signing does to the signer's balances, from the dry run
export default defineComponent({
    components: { NftChip },
    props: {
        changes: { type: Object as () => BalanceChanges, required: true },
        gid: { type: String, required: true },
        tokens: { type: Array as () => M.TokenSpec[], default: () => [] },
        collections: { type: Object as () => Record<string, { name: string }>, default: () => ({}) }
    },
    computed: {
        rows(): Row[] {
            const rows: Row[] = []
            const abs = (v: bigint) => v < 0n ? -v : v
            const { vet, tokens, nfts } = this.changes
            if (vet !== 0n) {
                rows.push({ direction: vet > 0n ? 'in' : 'out', text: `${formatUnits(abs(vet), 18)} VET` })
            }
            for (const [address, delta] of Object.entries(tokens)) {
                const spec = this.tokens.find(t => t.address.toLowerCase() === address)
                const text = spec
                    ? `${formatUnits(abs(delta), spec.decimals)} ${spec.symbol}`
                    : `${formatUnits(abs(delta), 18)} ${address.slice(0, 6)}…${address.slice(-4)}`
                rows.push({ direction: delta > 0n ? 'in' : 'out', text })
            }
            for (const nft of nfts) {
                rows.push({ direction: nft.direction, nft })
            }
            // what leaves first, then what comes in
            return rows.sort((a, b) => (a.direction === b.direction ? 0 : a.direction === 'out' ? -1 : 1))
        },
        shownRows(): Row[] {
            return this.rows.slice(0, 8)
        }
    }
})
</script>
<style lang="sass" scoped>
.sim-row
  min-height: 40px
  & + &
    border-top: 1px solid $hairline

.sim-sign
  width: 22px
  height: 22px
  flex: none
  border-radius: 50%

.sim-sign--out
  color: $negative
  background: rgba(248, 113, 113, 0.12)

.sim-sign--in
  color: $primary
  background: rgba(110, 231, 183, 0.12)

.sim-amount
  font-size: 16px
</style>
