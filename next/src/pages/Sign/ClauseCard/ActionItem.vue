<template>
    <div
        class="action-op row no-wrap items-start q-px-md q-pb-md"
        :class="`action-op--${text.risk}`"
    >
        <div class="action-icon flex flex-center">
            <q-icon
                :name="text.icon"
                size="20px"
            />
        </div>
        <div
            class="col q-ml-md"
            style="min-width: 0"
        >
            <div class="action-text">{{text.text}}</div>
            <div
                v-if="text.detail"
                class="action-detail q-mt-xs"
            >{{text.detail}}</div>
            <div class="text-muted action-to q-mt-xs ellipsis">
                <address-label :addr="op.to" />
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import AddressLabel from 'src/components/AddressLabel.vue'
import type { Action } from 'src/utils/actions'
import { describeAction, type ActionText } from 'src/utils/describe-action'

export type OpAction = {
    type: 'action'
    action: Action
    to: string
}

// a contract call we can read: what it does, in a sentence, and how careful to be
export default defineComponent({
    components: { AddressLabel },
    props: {
        op: { type: Object as () => OpAction, required: true },
        tokens: { type: Array as () => M.TokenSpec[], default: () => [] },
        collections: { type: Object as () => Record<string, { name: string }>, default: () => ({}) }
    },
    computed: {
        text(): ActionText {
            return describeAction(this.op.action, {
                t: (key, params) => this.$t(key, params ?? {}),
                token: address => this.tokens.find(t => t.address.toLowerCase() === address.toLowerCase()),
                collection: address => this.collections[address.toLowerCase()]?.name
            })
        }
    }
})
</script>
<style lang="sass" scoped>
.action-icon
  width: 36px
  height: 36px
  flex: none
  border-radius: 10px
  border: 1px solid $hairline
  background: rgba(255, 255, 255, 0.04)

.action-text
  font-size: 16px
  font-weight: 800
  line-height: 1.3

.action-detail
  font-size: 13px
  line-height: 1.4

.action-to
  font-size: 12px

.action-op--ok .action-icon
  color: $primary

.action-op--warn
  .action-icon
    color: $warning
    border-color: rgba(251, 191, 36, 0.35)
  .action-detail
    color: $warning

.action-op--danger
  .action-icon
    color: $negative
    border-color: rgba(248, 113, 113, 0.45)
    background: rgba(248, 113, 113, 0.08)
  .action-detail
    color: $negative
</style>
