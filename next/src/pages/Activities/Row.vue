<template>
    <q-item
        clickable
        class="activity-row"
        @click="$emit('open')"
    >
        <q-item-section avatar>
            <!-- the token's logo or the NFT's picture, with a small arrow for in or out -->
            <div
                v-if="row.image && !broken"
                class="row-image"
            >
                <img
                    :src="row.image"
                    alt=""
                    loading="lazy"
                    @error="broken = true"
                >
                <span
                    class="row-badge flex flex-center"
                    :class="`row-icon--${row.tone}`"
                >
                    <q-icon
                        :name="row.icon"
                        size="11px"
                    />
                </span>
            </div>
            <div
                v-else
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
            <!-- who (shortened when long) and when (always whole) -->
            <q-item-label
                caption
                class="row no-wrap items-center row-meta"
            >
                <span
                    v-if="row.counterparty"
                    class="row-who ellipsis"
                >{{row.counterpartyLabel}} <address-label
                    compact
                    :addr="row.counterparty"
                /></span>
                <span
                    v-if="row.counterparty"
                    class="q-mx-xs"
                >·</span>
                <span class="row-time">{{time}}</span>
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
    /** the token's logo or the NFT's picture */
    image?: string
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
    data: () => ({ prefs, broken: false }),
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
  // a title that starts lower-case ("een NFT …") still reads as a sentence
  &::first-letter
    text-transform: uppercase

.row-image
  position: relative
  width: 40px
  height: 40px
  img
    width: 40px
    height: 40px
    border-radius: 12px
    object-fit: cover
    background: rgba(255, 255, 255, 0.05)

.row-badge
  position: absolute
  right: -3px
  bottom: -3px
  width: 18px
  height: 18px
  border-radius: 50%
  border: 2px solid $dark-page
  background: $surface-2

.row-meta
  min-width: 0

.row-who
  min-width: 0
  :deep(.address)
    display: inline

.row-time
  flex: none

.row-note
  font-style: italic

.row-amount
  font-size: 15px
  white-space: nowrap
</style>
