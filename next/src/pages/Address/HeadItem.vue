<template>
    <div
        v-bind="$attrs"
        class="bvm-tile head row no-wrap items-center"
    >
        <address-avatar
            :addr="address"
            size="48px"
        />
        <div class="col q-ml-md" style="min-width: 0">
            <div class="head-name ellipsis">{{name}}</div>
            <address-label
                class="text-muted"
                :addr="address"
            />
        </div>
    </div>
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
        address: { type: String, required: true },
        name: String
    }
})
</script>
<style lang="sass" scoped>
.head
  margin: 16px 16px 8px
  padding: 16px

.head-name
  font-size: 18px
  font-weight: 900
  letter-spacing: -0.01em
</style>
