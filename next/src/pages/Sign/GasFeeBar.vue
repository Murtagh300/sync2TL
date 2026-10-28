<template>
    <q-item>
        <q-item-section avatar>
            <q-item-label caption class="text-muted">{{$t('sign.label_estimate_fee')}}<help-tip term="gas" /></q-item-label>
        </q-item-section>
        <q-item-section>
            <q-item-label>
                <amount-label
                    v-if="fee"
                    class="bvm-amount fee-amount"
                    :value="fee"
                    :decimals="18"
                />
                <q-spinner-dots
                    v-else
                    color="primary"
                />
                <q-avatar size="1em">
                    <img src="~assets/vtho.svg">
                </q-avatar>
                <!-- what the fee is worth, so "0,21" means something -->
                <q-item-label
                    v-if="fee && fiat"
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

const ENERGY = '0x0000000000000000000000000000456e65726779'

export default defineComponent({
    components: { AmountLabel, HelpTip },
    props: {
        fee: String,
        isDelegation: Boolean
    },
    data: () => ({
        /** one VTHO in the chosen currency; 0 when unknown */
        vthoPrice: 0
    }),
    computed: {
        fiat(): string {
            if (!this.fee || !this.vthoPrice) return ''
            return money(new BigNumber(this.fee).div(1e18).toNumber() * this.vthoPrice)
        }
    },
    async created() {
        try {
            const [stats, fx] = await Promise.all([this.$svc.prices.stats([ENERGY]), this.$svc.prices.fx(prefs.currency)])
            const s = stats[ENERGY]
            this.vthoPrice = s ? s.price * fx : 0
        } catch {
            // no price: the fee in VTHO only
        }
    }
})
</script>
<style lang="sass" scoped>
.fee-amount
  font-size: 16px
</style>
