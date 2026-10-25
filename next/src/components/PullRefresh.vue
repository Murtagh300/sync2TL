<template>
    <!-- Quasar turns the icon as you pull: the BVM mark spins into place -->
    <q-pull-to-refresh
        class="bv-pull"
        color="primary"
        bg-color="dark"
        :icon="icon"
        @refresh="(done: () => void) => $emit('refresh', done)"
    >
        <slot />
    </q-pull-to-refresh>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import bvmIcon from 'assets/bvm-icon.png'

// pull down to refresh, in BlackVeMarket's colors
export default defineComponent({
    emits: ['refresh'],
    data: () => ({
        icon: `img:${bvmIcon}`
    })
})
</script>
<style lang="sass" scoped>
.bv-pull :deep(.q-pull-to-refresh__puller)
  border: 1px solid var(--q-primary)
  box-shadow: 0 0 0 4px var(--bv-accent-soft), 0 6px 18px rgba(0, 0, 0, 0.5)
  .q-icon img
    border-radius: 50%
</style>
