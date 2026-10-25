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
        <q-btn
            outline
            no-caps
            dense
            color="primary"
            icon="o_qr_code_2"
            class="q-px-sm q-ml-sm"
            :label="$t('address.action_receive')"
            @click="showQR"
        />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import AddressAvatar from 'src/components/AddressAvatar.vue'
import AddressLabel from 'src/components/AddressLabel.vue'
import { address } from 'thor-devkit'

export default defineComponent({
    components: {
        AddressAvatar,
        AddressLabel
    },
    props: {
        address: { type: String, required: true },
        name: String
    },
    methods: {
        showQR() {
            const content = address.toChecksumed(this.address)
            this.$qrcode({
                title: this.$t('address.action_receive').toString(),
                content,
                message: content,
                messageClass: 'text-center'
            })
        }
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
