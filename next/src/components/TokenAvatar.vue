<template>
    <q-avatar
        v-bind="$attrs"
        color="white"
        class="bordered"
    >
        <q-img
            :src="spec.iconSrc"
            class="fit"
            style="border-radius:inherit"
            spinner-size="100%"
        />
    </q-avatar>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
    props: {
        spec: { type: Object as () => M.TokenSpec, required: true }
    }
})
</script>
<style scoped>
.bordered {
    box-sizing: content-box;
    border: 1px solid rgba(0, 0, 0, 0.2);
}
</style>
