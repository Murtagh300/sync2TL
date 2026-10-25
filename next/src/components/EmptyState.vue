<template>
    <!-- an empty list says what goes here, and offers the way to fill it -->
    <div
        class="empty-state column items-center text-center"
        role="status"
    >
        <q-icon
            :name="icon"
            size="40px"
            class="empty-icon"
        />
        <p class="empty-text q-mt-md q-mb-none">{{text}}</p>
        <q-btn
            v-if="action"
            outline
            no-caps
            color="primary"
            class="q-mt-md"
            :icon="actionIcon"
            :label="action"
            @click="$emit('action')"
        />
        <slot />
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
    emits: ['action'],
    props: {
        icon: { type: String, required: true },
        text: { type: String, required: true },
        action: String,
        actionIcon: String
    }
})
</script>
<style lang="sass" scoped>
.empty-state
  padding: 40px 24px

.empty-icon
  color: var(--q-primary)
  opacity: 0.8

.empty-text
  max-width: 32ch
  color: $text-soft
  line-height: 1.45
</style>
