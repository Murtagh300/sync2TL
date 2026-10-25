<template>
    <div class="steps row no-wrap items-center q-mb-md">
        <template
            v-for="(label, i) in labels"
            :key="i"
        >
            <div
                class="step row no-wrap items-center"
                :class="{ 'step--done': i + 1 < current, 'step--now': i + 1 === current }"
            >
                <span class="step-dot flex flex-center">
                    <q-icon
                        v-if="i + 1 < current"
                        name="check"
                        size="14px"
                    />
                    <template v-else>{{i + 1}}</template>
                </span>
                <span class="step-label q-ml-xs gt-xs">{{label}}</span>
            </div>
            <div
                v-if="i < labels.length - 1"
                class="step-line col"
                :class="{ 'step-line--done': i + 1 < current }"
            />
        </template>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

// where the setup is: password, backup, first collection
export default defineComponent({
    props: {
        current: { type: Number, required: true }
    },
    computed: {
        labels(): string[] {
            return [this.$t('wizard.step_password'), this.$t('wizard.step_backup'), this.$t('wizard.step_follow')]
        }
    }
})
</script>
<style lang="sass" scoped>
.step-dot
  width: 24px
  height: 24px
  border-radius: 50%
  border: 1px solid $hairline-2
  font-size: 12px
  font-weight: 800
  color: $text-muted

.step--now .step-dot
  border-color: var(--q-primary)
  color: var(--q-primary)

.step--done .step-dot
  border-color: var(--q-primary)
  background: var(--q-primary)
  color: $on-primary

.step-label
  font-size: 12px
  font-weight: 700
  color: $text-muted

.step--now .step-label
  color: $text

.step-line
  height: 1px
  margin: 0 8px
  background: $hairline-2

.step-line--done
  background: var(--q-primary)
</style>
