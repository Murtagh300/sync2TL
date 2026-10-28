<template>
    <!-- what to know about the contracts and the whole transaction, the worst first -->
    <div
        v-if="labels.length"
        class="bvm-tile risk-card"
        :class="{ 'risk-card--danger': danger }"
        role="alert"
    >
        <div
            v-if="danger"
            class="risk-head row no-wrap items-center"
        >
            <q-icon
                name="o_gpp_bad"
                size="20px"
                class="q-mr-sm"
            />
            <span>{{$t('risk.title_danger')}}</span>
        </div>
        <div
            v-for="(l, i) in labels"
            :key="i"
            class="risk-row row no-wrap items-start"
        >
            <q-icon
                :name="icon(l.level)"
                :color="color(l.level)"
                size="18px"
                class="q-mr-sm risk-icon"
            />
            <span class="col">{{$t(`risk.${l.key}`, l.params || {})}}</span>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import type { RiskLabel, RiskLevel } from 'src/utils/risk'

export default defineComponent({
    props: {
        labels: { type: Array as () => RiskLabel[], required: true }
    },
    computed: {
        danger(): boolean {
            return this.labels.some(l => l.level === 'danger')
        }
    },
    methods: {
        icon(l: RiskLevel) {
            return l === 'danger' ? 'o_dangerous' : l === 'warn' ? 'o_warning_amber' : 'o_info'
        },
        color(l: RiskLevel) {
            return l === 'danger' ? 'negative' : l === 'warn' ? 'warning' : 'grey-5'
        }
    }
})
</script>
<style lang="sass" scoped>
.risk-card
  padding: 10px 12px
  font-size: 13px

.risk-card--danger
  border-color: rgba(248, 113, 113, 0.55)
  background: rgba(248, 113, 113, 0.08)

.risk-head
  color: $negative
  font-weight: 800
  font-size: 14px
  margin-bottom: 6px

.risk-row + .risk-row
  margin-top: 6px

.risk-icon
  margin-top: 1px
</style>
