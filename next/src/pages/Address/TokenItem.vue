<template>
    <q-expansion-item
        group="token"
        v-bind="$attrs"
        expand-icon-class="hidden"
    >
        <template v-slot:header>
            <q-item-section avatar>
                <token-avatar
                    size="md"
                    :spec="token"
                />
            </q-item-section>
            <q-item-section>
                <q-item-label class="token-symbol">{{token.symbol}}</q-item-label>
                <q-item-label
                    caption
                    class="text-muted ellipsis"
                >
                    <template v-if="stat">
                        <span>{{money(stat.price * fx)}}</span>
                        <span
                            class="q-ml-xs token-change"
                            :class="stat.change24h >= 0 ? 'text-primary' : 'text-negative'"
                        >{{stat.change24h >= 0 ? '+' : ''}}{{stat.change24h.toFixed(1)}}%</span>
                    </template>
                    <template v-else>{{token.name}}</template>
                </q-item-label>
            </q-item-section>
            <q-item-section side>
                <amount-label
                    class="bvm-amount token-amount"
                    :value="balance"
                    :decimals="token.decimals"
                > --.-- </amount-label>
                <q-item-label
                    v-if="value !== null"
                    caption
                    class="text-muted token-fiat"
                >{{money(value)}}</q-item-label>
            </q-item-section>
        </template>
        <div class="row justify-end q-gutter-sm q-px-md q-pb-md">
            <slot />
        </div>
    </q-expansion-item>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import TokenAvatar from 'components/TokenAvatar.vue'
import AmountLabel from 'components/AmountLabel.vue'
import { BigNumber } from 'bignumber.js'
import { money } from 'src/utils/prefs'
import type { Prices } from 'boot/services/prices'

export default defineComponent({
    components: {
        TokenAvatar,
        AmountLabel
    },
    props: {
        token: { type: Object as () => M.TokenSpec, required: true },
        balance: String as () => '',
        stat: Object as () => Prices.Stat | undefined,
        /** fiat per USD */
        fx: { type: Number, default: 1 }
    },
    computed: {
        /** the balance in fiat, when priced */
        value(): number | null {
            if (!this.stat || !this.balance) {
                return null
            }
            return new BigNumber(this.balance).div(new BigNumber(10).pow(this.token.decimals)).toNumber() * this.stat.price * this.fx
        }
    },
    methods: { money }
})
</script>
<style lang="sass" scoped>
.token-symbol
  font-weight: 800

.token-amount
  font-size: 16px
  color: $text

.token-fiat
  text-align: right
  font-variant-numeric: tabular-nums

.token-change
  font-weight: 700
</style>
