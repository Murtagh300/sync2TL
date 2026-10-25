<template>
    <q-item
        v-bind="$attrs"
        :class="classes"
        :dark="!invert"
    >
        <q-item-section avatar>
            <q-icon :name="icon" />
        </q-item-section>
        <q-item-section v-if="error">
            <q-item-label>
                {{error.name}}
            </q-item-label>
            <q-item-label caption>
                {{error.message}}
            </q-item-label>
        </q-item-section>
    </q-item>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
    props: {
        type: String as () => 'error' | 'warning',
        error: Object as () => Error,
        invert: Boolean
    },
    computed: {
        icon() {
            switch (this.type) {
                case 'warning': return 'o_warning_amber'
                default: return 'o_error_outline'
            }
        },
        classes() {
            if (this.invert) {
                switch (this.type) {
                    case 'warning': return 'text-warning'
                    default: return 'text-negative'
                }
            } else {
                switch (this.type) {
                    case 'warning': return 'tip tip--warning'
                    default: return 'tip tip--error'
                }
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.tip
  margin: 0 12px 8px
  border-radius: $radius-lg
  border: 1px solid
  font-weight: 700

.tip--warning
  color: $warning
  border-color: rgba(251, 191, 36, 0.4)
  background: rgba(251, 191, 36, 0.06)

.tip--error
  color: $negative
  border-color: rgba(248, 113, 113, 0.4)
  background: rgba(248, 113, 113, 0.06)
</style>
