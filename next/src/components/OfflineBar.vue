<template>
    <transition name="offline">
        <div
            v-if="!network.online"
            class="offline-bar row no-wrap items-center justify-center"
            role="status"
        >
            <q-icon
                name="o_cloud_off"
                size="16px"
                class="q-mr-sm"
            />
            {{$t('offline.msg')}}
        </div>
    </transition>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { network } from 'src/utils/network'

// says so when the device is offline: what shows is the last known state
export default defineComponent({
    data: () => ({ network })
})
</script>
<style lang="sass" scoped>
.offline-bar
  flex: none
  padding: 6px 12px
  padding-top: calc(6px + env(safe-area-inset-top))
  background: $warning
  color: $on-primary
  font-size: 13px
  font-weight: 800

.offline-enter-active, .offline-leave-active
  transition: margin-top 0.2s, opacity 0.2s

.offline-enter-from, .offline-leave-to
  opacity: 0
  margin-top: -32px
</style>
