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
            <span
                v-if="shown.state === 'pending'"
                class="tx-status-time q-ml-sm"
            >{{elapsed}}s</span>
            <!-- a block every ~10 s: the bar fills toward the expected confirmation -->
            <div
                v-if="shown.state === 'pending'"
                class="tx-status-progress"
                :style="{ width: progress + '%' }"
            />
            <!-- a while without a block: look again now, or put the bar away -->
            <q-btn
                v-if="stuck"
                :aria-label="$t('txStatus.action_recheck')"
                flat
                round
                dense
                size="sm"
                icon="o_refresh"
                :loading="rechecking"
                @click.stop="recheck()"
            />
            <q-btn
                :aria-label="$t('common.close')"
                v-if="shown.state !== 'pending' || stuck"
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
import { notify as addNotification } from 'src/utils/notifications'
import { leftoverApprovals, type Leftover } from 'src/utils/leftover-approvals'
import { who } from 'src/utils/describe-action'
import { fns } from 'src/utils/actions'
import { formatUnits } from 'src/utils/format'

type Shown = { id: string, activityId: number, gid: string, signer: string, since: number, state: 'pending' | 'done' | 'failed', label: string, count: number }

// a transaction usually lands in 10–20 s; after this the bar offers to look again or close
const STUCK_AFTER = 2 * 60 * 1000

// transactions on their way, at the bottom of every page, until they are in a block
export default defineComponent({
    data: () => ({
        shown: null as Shown | null,
        timer: 0 as ReturnType<typeof setInterval> | 0,
        // when each tx was first seen in a block, to show "done" a few seconds
        doneAt: {} as Record<string, number>,
        dismissed: {} as Record<string, true>,
        now: Date.now(),
        rechecking: false
    }),
    computed: {
        elapsed(): number {
            return this.shown ? Math.max(0, Math.round((this.now - this.shown.since) / 1000)) : 0
        },
        stuck(): boolean {
            return !!this.shown && this.shown.state === 'pending' && this.now - this.shown.since > STUCK_AFTER
        },
        progress(): number {
            // eases toward 95% over ~20 s, so a slow block never looks finished
            return Math.min(95, 100 * (1 - Math.exp(-this.elapsed / 9)))
        },
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
            this.now = Date.now()
            try {
                const recent = (await this.$svc.activity.page(10, 0))
                    .filter(a => a.type === 'tx' && a.createdTime > Date.now() - 10 * 60 * 1000 && !this.dismissed[a.glob.id])
                const pending = recent.filter(a => a.type === 'tx' && !a.glob.receipt && a.status !== 'completed')
                const label = (a: M.Activity) => (a.type === 'tx' && a.glob.comment) || this.$t('common.transaction')
                if (pending.length) {
                    const p = pending[0]!
                    this.shown = { id: p.glob.id, activityId: p.id, gid: p.gid, signer: p.glob.signer, since: p.createdTime, state: 'pending', label: label(p), count: pending.length }
                    return
                }
                // the latest one that made it into a block: show the outcome a few seconds
                const landed = recent.find(a => a.type === 'tx' && !!a.glob.receipt)
                if (landed && landed.type === 'tx') {
                    const id = landed.glob.id
                    if (!this.doneAt[id]) {
                        this.doneAt[id] = Date.now()
                        const failed = landed.glob.receipt!.reverted
                        addNotification({
                            id: `tx:${id}`,
                            kind: failed ? 'tx-failed' : 'tx-done',
                            title: this.$t(failed ? 'txStatus.msg_failed' : 'txStatus.msg_done', { label: label(landed) }),
                            route: { name: 'tx', params: { gid: landed.gid, txId: id }, query: { me: landed.glob.signer } }
                        })
                        haptic(landed.glob.receipt!.reverted ? 'warning' : 'success')
                        if (!failed) {
                            void this.offerRevoke(landed.gid, landed.glob.encoded, landed.glob.signer)
                        }
                    }
                    if (Date.now() - this.doneAt[id]! < 6000) {
                        this.shown = { id, activityId: landed.id, gid: landed.gid, signer: landed.glob.signer, since: landed.createdTime, state: landed.glob.receipt!.reverted ? 'failed' : 'done', label: label(landed), count: 1 }
                        return
                    }
                }
                this.shown = null
            } catch {
                this.shown = null
            }
        },
        /** ask the node for the receipt now (the updater does so with each block) */
        async recheck() {
            const s = this.shown
            if (!s || this.rechecking) return
            this.rechecking = true
            try {
                const receipt = await this.$svc.bc(s.gid).thor.transaction(s.id).getReceipt()
                const [a] = (await this.$svc.activity.page(20, 0)).filter(x => x.id === s.activityId)
                if (receipt && a && a.type === 'tx') {
                    await this.$svc.activity.update(a.id, { glob: { ...a.glob, receipt } })
                } else {
                    this.$q.notify({ message: this.$t('txStatus.msg_still_pending') })
                }
                await this.check()
            } catch {
                this.$q.notify({ message: this.$t('common.something_wrong'), color: 'negative' })
            } finally {
                this.rechecking = false
            }
        },
        dismiss() {
            if (this.shown) {
                this.dismissed[this.shown.id] = true
                this.shown = null
            }
        },
        open() {
            const s = this.shown
            if (s && s.count === 1) {
                void this.$router.push({ name: 'tx', params: { gid: s.gid, txId: s.id }, query: { me: s.signer } })
            } else {
                void this.$router.push({ name: 'activities' })
            }
        },
        /** an approval the transaction left unused: offer to revoke it now */
        async offerRevoke(gid: string, encoded: string, owner: string) {
            let left: Leftover[] = []
            try {
                left = await leftoverApprovals(this.$svc.bc(gid).thor, encoded, owner)
            } catch {
                return
            }
            if (!left.length) {
                return
            }
            const tokens = (await this.$svc.config.token.all()).filter(t => t.gid === gid)
            for (const l of left) {
                const spec = tokens.find(t => (t.address || '').toLowerCase() === l.token)
                const amount = spec ? `${formatUnits(l.allowance, spec.decimals)} ${spec.symbol}` : this.$t('approvalReminder.label_tokens')
                this.$q.notify({
                    color: 'secondary',
                    icon: 'o_key',
                    message: this.$t('approvalReminder.msg', { amount, spender: who(l.spender) }),
                    position: 'top',
                    timeout: 15 * 1000,
                    actions: [
                        { label: this.$t('approvalReminder.action_revoke'), color: 'primary', handler: () => void this.revoke(gid, owner, l, amount) },
                        { label: this.$t('common.close'), color: 'white' }
                    ]
                })
            }
        },
        async revoke(gid: string, owner: string, l: Leftover, amount: string) {
            const comment = this.$t('approvalReminder.comment', { amount, spender: who(l.spender) })
            try {
                await this.$signTx(gid, {
                    message: [{ to: l.token, value: '0', data: fns.approve.encode(l.spender, 0), comment }],
                    options: { signer: owner, comment }
                })
            } catch {
                // declined
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.tx-status
  overflow: hidden
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

.tx-status-time
  font-size: 12px
  font-variant-numeric: tabular-nums
  opacity: 0.7

.tx-status-progress
  position: absolute
  left: 0
  bottom: 0
  height: 2px
  background: var(--q-primary)
  transition: width 2.5s linear

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
