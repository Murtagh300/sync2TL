<template>
    <q-item
        clickable
        class="activity-row"
        @click="$emit('open')"
    >
        <q-item-section avatar>
            <div
                class="row-icon flex flex-center"
                :class="`row-icon--${row.tone}`"
            >
                <q-icon
                    :name="row.icon"
                    size="20px"
                />
            </div>
        </q-item-section>
        <q-item-section style="min-width: 0">
            <q-item-label
                lines="1"
                class="row-title"
            >{{row.title}}</q-item-label>
            <q-item-label
                caption
                lines="1"
            >
                <template v-if="row.counterparty">{{row.counterpartyLabel}} <address-label :addr="row.counterparty" /> · </template>{{time}}
            </q-item-label>
            <q-item-label
                v-if="row.note"
                caption
                lines="1"
                class="row-note"
            >“{{row.note}}”</q-item-label>
        </q-item-section>
        <q-item-section side>
            <div
                v-if="row.amount"
                class="bvm-amount row-amount"
                :class="row.tone === 'in' ? 'text-primary' : ''"
            >{{prefs.hideBalances ? '••••' : row.amount}}</div>
            <q-badge
                v-if="row.status"
                :color="row.status === 'failed' ? 'negative' : 'warning'"
                text-color="dark"
                :label="row.statusLabel"
            />
        </q-item-section>
    </q-item>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import AddressLabel from 'components/AddressLabel.vue'
import { prefs } from 'src/utils/prefs'

export type ActivityRow = {
    key: string
    time: number
    title: string
    icon: string
    /** in: something arrived; out: something left; neutral: anything else; fail: did not go through */
    tone: 'in' | 'out' | 'neutral' | 'fail'
    amount?: string
    counterparty?: string
    counterpartyLabel?: string
    note?: string
    status?: 'pending' | 'failed' | 'expired'
    statusLabel?: string
    /** what moved, for the export: an amount of a token (VET: '') */
    asset?: { amount: number, token: string }
    txId?: string
}

// one line of activity: what, with whom, when, how much
export default defineComponent({
    components: { AddressLabel },
    props: {
        row: { type: Object as () => ActivityRow, required: true }
    },
    emits: ['open'],
    data: () => ({ prefs }),
    computed: {
        time(): string {
            return new Date(this.row.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        }
    }
})
</script>
<style lang="sass" scoped>
.row-icon
  width: 40px
  height: 40px
  border-radius: 12px
  background: rgba(255, 255, 255, 0.05)
  color: $text-soft

.row-icon--in
  color: var(--q-primary)
  background: color-mix(in srgb, var(--q-primary) 12%, transparent)

.row-icon--out
  color: $text

.row-icon--fail
  color: $negative
  background: rgba(248, 113, 113, 0.10)

.row-title
  font-weight: 800

.row-note
  font-style: italic

.row-amount
  font-size: 15px
  white-space: nowrap
</style>
