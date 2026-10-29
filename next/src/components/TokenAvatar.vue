<template>
    <q-avatar
        v-bind="$attrs"
        :color="spec.iconSrc && !failed ? 'white' : 'dark'"
        :text-color="spec.iconSrc && !failed ? undefined : 'primary'"
        class="bordered"
    >
        <q-img
            v-if="spec.iconSrc && !failed"
            :src="spec.iconSrc"
            class="fit"
            style="border-radius:inherit"
            spinner-size="100%"
            @error="failed = true"
        />
        <!-- a token without a logo (added by hand, or new): its first letter -->
        <span
            v-else
            class="token-letter"
        >{{(spec.symbol || '?').slice(0, 1).toUpperCase()}}</span>
    </q-avatar>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
    props: {
        spec: { type: Object as () => M.TokenSpec, required: true }
    },
    data: () => ({
        failed: false
    }),
    watch: {
        'spec.iconSrc'() { this.failed = false }
    }
})
</script>
<style scoped>
.bordered {
    box-sizing: content-box;
    border: 1px solid rgba(0, 0, 0, 0.2);
}

.token-letter {
    font-weight: 900;
    font-size: 0.5em;
}
</style>
