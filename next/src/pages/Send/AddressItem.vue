<template>
    <q-item
        v-bind="$attrs"
    >
        <q-item-section avatar>
            <address-avatar size="md" :addr="address" />
        </q-item-section>
        <q-item-section>
            <address-label
                no-icon
                :addr="address"
            />
        </q-item-section>
    </q-item>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import AddressAvatar from 'src/components/AddressAvatar.vue'
import AddressLabel from 'src/components/AddressLabel.vue'
export default defineComponent({
    components: {
        AddressAvatar,
        AddressLabel
    },
    props: {
        address: String
    }
})
</script>
<style scoped>
.reline {
    word-break: break-all;
}
</style>
