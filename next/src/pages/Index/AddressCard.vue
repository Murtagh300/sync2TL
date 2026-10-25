<template>
    <div
        class="address-card bvm-tile column no-wrap cursor-pointer"
        :style="glow"
    >
        <!-- identity: avatar, number, address -->
        <div class="row no-wrap items-center">
            <address-avatar
                size="36px"
                :addr="address"
            />
            <div class="q-ml-sm col">
                <div class="card-index bvm-display">#{{index + 1}}</div>
                <address-label
                    no-icon
                    class="text-muted"
                    :addr="address"
                    style="font-size: 12px"
                />
            </div>
            <img
                src="~assets/vechain-logo.svg"
                class="card-chain"
                alt=""
            >
        </div>

        <!-- VET: the number this card is about -->
        <div class="q-mt-auto">
            <div class="card-vet bvm-display ellipsis">
                <amount-label
                    :value="vet"
                    :decimals="18"
                >--.--</amount-label>
            </div>
            <div class="row items-center q-mt-xs card-symbol">
                <img
                    src="~assets/vet.svg"
                    class="card-coin"
                    alt=""
                >
                VET
            </div>
        </div>

        <!-- VTHO, quieter -->
        <div class="card-vtho row items-center no-wrap q-mt-sm">
            <img
                src="~assets/vtho.svg"
                class="card-coin"
                alt=""
            >
            <amount-label
                class="bvm-amount q-ml-xs"
                :value="vtho"
                :decimals="18"
            >--.--</amount-label>
            <span class="q-ml-xs">VTHO</span>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { picasso } from '@vechain/picasso'
import Color from 'color'
import AddressLabel from 'src/components/AddressLabel.vue'
import AmountLabel from 'src/components/AmountLabel.vue'
import AddressAvatar from 'src/components/AddressAvatar.vue'
import { balanceKey, readSnapshot, writeSnapshot } from 'src/utils/snapshot'

export default defineComponent({
    components: { AddressLabel, AmountLabel, AddressAvatar },
    props: {
        address: { type: String, required: true },
        index: { type: Number, required: true },
        account: Object as () => (Connex.Thor.Account | null),
        gid: { type: String, default: '' }
    },
    computed: {
        // a faint glow in the address' own avatar color tells the cards apart
        glow(): Record<string, string> {
            const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(picasso(this.address))
            const c = Color(m ? m[0] : '#6ee7b7').saturationl(70).lightness(55)
            return {
                backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${c.alpha(0.22).rgb().string()}, transparent 60%)`
            }
        },
        vet(): string | null {
            return this.account ? this.account.balance : this.cached('VET')
        },
        vtho(): string | null {
            return this.account ? this.account.energy : this.cached('VTHO')
        }
    },
    watch: {
        account(a: Connex.Thor.Account | null) {
            if (a && this.gid) {
                writeSnapshot(balanceKey(this.gid, this.address, 'VET'), a.balance)
                writeSnapshot(balanceKey(this.gid, this.address, 'VTHO'), a.energy)
            }
        }
    },
    methods: {
        cached(symbol: string): string | null {
            return this.gid ? readSnapshot<string>(balanceKey(this.gid, this.address, symbol))?.value ?? null : null
        }
    }
})
</script>
<style lang="sass" scoped>
.address-card
  height: 100%
  padding: 16px 18px
  text-align: left
  transition: border-color 0.15s
  &:hover
    border-color: rgba(255, 255, 255, 0.22)

.card-index
  font-size: 18px

.card-chain
  width: 22px
  height: 22px
  opacity: 0.25
  align-self: flex-start

.card-vet
  font-size: clamp(34px, 11vw, 46px)

.card-symbol
  font-size: 13px
  font-weight: 800
  color: $text-soft

.card-coin
  width: 16px
  height: 16px
  margin-right: 6px

.card-vtho
  padding-top: 10px
  border-top: 1px solid $hairline
  font-size: 13px
  color: $text-muted
</style>
