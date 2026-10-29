<template>
    <q-item>
        <q-item-section avatar>
            <q-item-label caption class="text-muted">{{$t('sign.label_estimate_fee')}}<help-tip term="gas" /></q-item-label>
        </q-item-section>
        <q-item-section>
            <q-item-label>
                <!-- paid in VET or B3TR through VeChain's delegator -->
                <template v-if="tokenFee">
                    <span
                        v-if="tokenFee.cost > 0"
                        class="bvm-amount fee-amount"
                    >{{tokenAmount}}</span>
                    <bv-loader
                        v-else
                        color="primary"
                    />
                    <q-avatar size="1em">
                        <img :src="tokenFee.icon">
                    </q-avatar>
                </template>
                <template v-else>
                    <amount-label
                        v-if="fee"
                        class="bvm-amount fee-amount"
                        :value="fee"
                        :decimals="18"
                    />
                    <bv-loader
                        v-else
                        color="primary"
                    />
                    <q-avatar size="1em">
                        <img src="~assets/vtho.svg">
                    </q-avatar>
                </template>
                <!-- what the fee is worth, so "0,21" means something -->
                <q-item-label
                    v-if="fiat"
                    caption
                >≈ {{fiat}}</q-item-label>
                <q-item-label v-if="isDelegation" caption>{{$t('sign.msg_fee_delegation')}}<help-tip term="sponsor" /></q-item-label>
            </q-item-label>
        </q-item-section>
        <q-item-section side>
            <q-item-label>
                <slot />
            </q-item-label>
        </q-item-section>
    </q-item>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import HelpTip from 'components/HelpTip.vue'
import AmountLabel from 'src/components/AmountLabel.vue'
import { BigNumber } from 'bignumber.js'
import { money, prefs } from 'src/utils/prefs'
import { B3TR } from 'src/utils/ecosystem'

const ENERGY = '0x0000000000000000000000000000456e65726779'
const VET = '0x0000000000000000000000000000000000000000'

export default defineComponent({
    components: { AmountLabel, HelpTip },
    props: {
        fee: String,
        isDelegation: Boolean,
        /** the fee in another token: its symbol, icon and cost in its own units (0 while quoting) */
        tokenFee: Object as () => { symbol: 'VET' | 'B3TR', icon: string, cost: number } | null
    },
    data: () => ({
        /** one token in the chosen currency, by address; missing when unknown */
        price: {} as Record<string, number>
    }),
    computed: {
        tokenAmount(): string {
            const t = this.tokenFee
            if (!t) return ''
            // a fee of a few hundredths: enough digits to show it, never a long tail
            return new BigNumber(t.cost).toFormat(t.cost < 0.01 ? 4 : t.cost < 1 ? 3 : 2)
        },
        fiat(): string {
            const t = this.tokenFee
            if (t) {
                const p = this.price[t.symbol === 'VET' ? VET : B3TR]
                return t.cost > 0 && p ? money(t.cost * p) : ''
            }
            const p = this.price[ENERGY]
            if (!this.fee || !p) return ''
            return money(new BigNumber(this.fee).div(1e18).toNumber() * p)
        }
    },
    async created() {
        try {
            const [stats, fx] = await Promise.all([this.$svc.prices.stats([ENERGY, VET, B3TR]), this.$svc.prices.fx(prefs.currency)])
            const price: Record<string, number> = {}
            for (const [k, v] of Object.entries(stats)) price[k.toLowerCase()] = v.price * fx
            this.price = price
        } catch {
            // no price: the fee in its token only
        }
    }
})
</script>
<style lang="sass" scoped>
.fee-amount
  font-size: 16px
</style>
