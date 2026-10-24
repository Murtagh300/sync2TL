<template>
    <q-item
        v-bind="$attrs"
    >
        <q-item-section avatar>
            <token-avatar
                size="md"
                :spec="token"
            />
        </q-item-section>
        <q-item-section>
            <q-item-label>{{token.symbol}}</q-item-label>
        </q-item-section>
        <q-item-section side>
            <q-item-label>
                <amount-label
                    :value="balance"
                    :decimals="token.decimals"
                >--.--</amount-label>
            </q-item-label>
        </q-item-section>
        <q-item-section
            v-if="selectIcon"
            side
        >
            <q-icon name="unfold_more" />
        </q-item-section>
    </q-item>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import TokenAvatar from 'components/TokenAvatar.vue'
import AmountLabel from 'components/AmountLabel.vue'

export default defineComponent({
    components: {
        TokenAvatar,
        AmountLabel
    },
    props: {
        token: { type: Object as () => M.TokenSpec, required: true },
        balance: String,
        selectIcon: Boolean
    }
})
</script>
