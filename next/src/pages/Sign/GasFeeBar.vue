<template>
    <q-item>
        <q-item-section avatar>
            <q-item-label caption class="text-muted">{{$t('sign.label_estimate_fee')}}<help-tip term="gas" /></q-item-label>
        </q-item-section>
        <q-item-section>
            <q-item-label>
                <amount-label
                    v-if="fee"
                    class="bvm-amount"
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

export default defineComponent({
    components: { AmountLabel, HelpTip },
    props: {
        fee: String,
        isDelegation: Boolean
    }
})
</script>
