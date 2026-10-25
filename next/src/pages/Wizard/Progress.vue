<template>
    <transition-group
        tag="div"
        name="q-transition--jump-down"
        class="column q-gutter-y-sm no-wrap"
    >
        <div
            v-for="(_, i) in history"
            class="step row no-wrap items-center"
            :class="{ 'step--current': isCurrent(i) }"
            :key="i+''"
        >
            <q-spinner
                v-if="isCurrent(i)"
                size="18px"
                color="primary"
                class="q-mr-md"
            />
            <q-icon
                v-else
                name="o_check_circle"
                size="18px"
                color="primary"
                class="q-mr-md"
            />
            {{history[i]}}
        </div>
    </transition-group>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

// the setup steps as a checklist: done ones checked, the running one spinning
export default defineComponent({
    props: {
        current: String
    },
    data() {
        return {
            history: [] as string[]
        }
    },
    watch: {
        current(newVal: string) {
            this.history.push(newVal)
        }
    },
    methods: {
        isCurrent(i: number) {
            return i + 1 === this.history.length
        }
    }
})
</script>
<style lang="sass" scoped>
.step
  font-size: 16px
  font-weight: 600
  color: $text-muted

.step--current
  color: $text
</style>
