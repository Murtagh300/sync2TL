<template>
    <transition name="tx-status">
        <div
            v-if="shown"
            class="tx-status row no-wrap items-center"
            :class="`tx-status--${shown.state}`"
            role="status"
            aria-live="polite"
            @click="open()"
        >
            <q-spinner
                v-if="shown.state === 'pending'"
                size="18px"
                color="primary"
            />
            <q-icon
                v-else
                :name="shown.state === 'done' ? 'check_circle' : 'error'"
                size="20px"
            />
            <span class="q-ml-sm col ellipsis">{{text}}</span>
            <q-btn
                v-if="shown.state !== 'pending'"
                flat
                round
                dense
                size="sm"
                icon="close"
                @click.stop="dismiss()"
            />
        </div>
    </transition>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { haptic } from 'src/utils/prefs'

type Shown = { id: string, state: 'pending' | 'done' | 'failed', label: string, count: number }

// transactions on their way, at the bottom of every page, until they are in a block
export default defineComponent({
    data: () => ({
        shown: null as Shown | null,
        timer: 0 as ReturnType<typeof setInterval> | 0,
        // when each tx was first seen in a block, to show "done" a few seconds
        doneAt: {} as Record<string, number>,
        dismissed: {} as Record<string, true>
    }),
    computed: {
        text(): string {
            const s = this.shown
            if (!s) {
                return ''
            }
            if (s.state === 'pending') {
                return s.count > 1
                    ? this.$t('txStatus.msg_pending_many', { n: s.count })
                    : this.$t('txStatus.msg_pending', { label: s.label })
            }
            return this.$t(s.state === 'done' ? 'txStatus.msg_done' : 'txStatus.msg_failed', { label: s.label })
        }
    },
    created() {
        void this.check()
        this.timer = setInterval(() => void this.check(), 2500)
    },
    beforeUnmount() {
        this.timer && clearInterval(this.timer)
    },
    methods: {
        async check() {
            try {
                const recent = (await this.$svc.activity.page(10, 0))
                    .filter(a => a.type === 'tx' && a.createdTime > Date.now() - 10 * 60 * 1000 && !this.dismissed[a.glob.id])
                const pending = recent.filter(a => a.type === 'tx' && !a.glob.receipt && a.status !== 'completed')
                const label = (a: M.Activity) => (a.type === 'tx' && a.glob.comment) || this.$t('common.transaction')
                if (pending.length) {
                    this.shown = { id: pending[0]!.glob.id, state: 'pending', label: label(pending[0]!), count: pending.length }
                    return
                }
                // the latest one that made it into a block: show the outcome a few seconds
                const landed = recent.find(a => a.type === 'tx' && !!a.glob.receipt)
                if (landed && landed.type === 'tx') {
                    const id = landed.glob.id
                    if (!this.doneAt[id]) {
                        this.doneAt[id] = Date.now()
                        haptic(landed.glob.receipt!.reverted ? 'warning' : 'success')
                    }
                    if (Date.now() - this.doneAt[id]! < 6000) {
                        this.shown = { id, state: landed.glob.receipt!.reverted ? 'failed' : 'done', label: label(landed), count: 1 }
                        return
                    }
                }
                this.shown = null
            } catch {
                this.shown = null
            }
        },
        dismiss() {
            if (this.shown) {
                this.dismissed[this.shown.id] = true
                this.shown = null
            }
        },
        open() {
            void this.$router.push({ name: 'activities' })
        }
    }
})
</script>
<style lang="sass" scoped>
.tx-status
  position: absolute
  left: 50%
  bottom: 12px
  z-index: 50
  width: min(420px, calc(100% - 24px))
  transform: translateX(-50%)
  padding: 10px 12px 10px 16px
  border-radius: 999px
  border: 1px solid $hairline-2
  background: rgba(17, 20, 19, 0.96)
  backdrop-filter: blur(10px)
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5)
  font-size: 14px
  font-weight: 700
  cursor: pointer

.tx-status--done
  border-color: var(--q-primary)
  color: var(--q-primary)

.tx-status--failed
  border-color: rgba(248, 113, 113, 0.5)
  color: $negative

.tx-status-enter-active, .tx-status-leave-active
  transition: opacity 0.2s, transform 0.2s

.tx-status-enter-from, .tx-status-leave-to
  opacity: 0
  transform: translate(-50%, 12px)
</style>
