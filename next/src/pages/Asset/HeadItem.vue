<template>
    <div
        v-bind="$attrs"
        class="bvm-tile asset-head"
    >
        <div class="row no-wrap items-center">
            <token-avatar
                v-if="token"
                size="40px"
                :spec="token"
            />
            <div class="col q-ml-md" style="min-width: 0">
                <slot />
            </div>
        </div>
        <div class="q-mt-lg">
            <slot name="balance" />
        </div>
        <slot name="action" />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import TokenAvatar from 'components/TokenAvatar.vue'

export default defineComponent({
    components: {
        TokenAvatar
    },
    props: {
        token: Object as () => M.TokenSpec | null
    }
})
</script>
<style lang="sass" scoped>
.asset-head
  margin: 16px 16px 0
  padding: 18px
</style>
