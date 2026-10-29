<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="$t('panic.title')"
            :gid="wallet?.gid"
        />
        <page-content
            class="col"
            padding
        >
            <div class="bvm-tile panic-intro q-pa-md q-mb-md row no-wrap items-start">
                <q-icon
                    name="o_emergency"
                    size="28px"
                    color="negative"
                />
                <p class="q-ml-md q-mb-none text-soft">{{$t('panic.msg_intro')}}</p>
            </div>

            <q-select
                v-if="signable.length > 1"
                v-model="walletId"
                :options="signable.map(w => ({ label: w.meta.name, value: w.id }))"
                emit-value
                map-options
                outlined
                dense
                :label="$t('panic.label_wallet')"
                class="q-mb-md"
            />

            <div class="bvm-label q-mb-xs">{{$t('panic.label_safe')}}</div>
            <q-select
                :model-value="prefs.safeAddress || null"
                :options="safeOptions"
                emit-value
                map-options
                outlined
                dense
                use-input
                clearable
                input-debounce="0"
                new-value-mode="add-unique"
                :placeholder="prefs.safeAddress ? '' : $t('panic.placeholder_safe')"
                :error="!!safeError"
                :error-message="safeError"
                @new-value="addSafe"
                @update:model-value="setSafe"
                class="q-mb-xs"
            />
            <p class="text-caption text-muted q-mb-md">{{prefs.safeAddress ? $t('panic.msg_safe_set') : $t('panic.msg_safe_none')}}</p>

            <div class="bvm-label q-mb-xs">{{$t('panic.label_plan')}}</div>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="k in 2"
                    :key="k"
                    height="64px"
                />
            </div>
            <q-list
                v-else
                role="group"
                class="bvm-list"
            >
                <q-item
                    v-for="s in steps"
                    :key="s.address"
                >
                    <q-item-section>
                        <q-item-label class="text-weight-bold">#{{s.index + 1}} <address-label :addr="s.address" /></q-item-label>
                        <q-item-label caption>{{describe(s)}}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <q-icon
                            v-if="s.sent"
                            name="check_circle"
                            color="primary"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
            <p class="text-caption text-muted q-mt-md">{{$t('panic.msg_notes', { n: RESERVE_VTHO })}}</p>
        </page-content>
        <page-action v-if="wallet">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="negative"
                icon="o_emergency"
                :loading="working"
                :disable="loading || !todo.length"
                :label="progress || (todo.length ? $t('panic.action', { n: todo.length }) : $t('panic.label_nothing'))"
                @click="run()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import { address as addr } from 'thor-devkit'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import AddressLabel from 'components/AddressLabel.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { visibleTokens } from 'src/utils/tokens'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { prefs, haptic } from 'src/utils/prefs'
import { findApprovals, revokeClause } from 'src/utils/approvals'
import { RESERVE_VTHO, sweepClauses, type Clause } from 'src/utils/sweep'

type Step = { index: number, address: string, revokes: number, parts: string[], clauses: Clause[], sent: boolean }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const isAddress = (v: string): boolean => addr.test(v)

// when a wallet may be compromised: revoke every approval, and move what's on it to a safe place
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel },
    props: {
        wid: String
    },
    data: () => ({
        RESERVE_VTHO,
        prefs,
        wallets: [] as M.Wallet[],
        contacts: [] as { name: string, address: string }[],
        walletId: null as number | null,
        steps: [] as Step[],
        loading: true,
        working: false,
        progress: '',
        safeError: ''
    }),
    computed: {
        signable(): M.Wallet[] {
            return this.wallets.filter(canSign)
        },
        wallet(): M.Wallet | null {
            return this.signable.find(w => w.id === this.walletId) || null
        },
        /** other wallets (a hardware or watch-only one is ideal) and contacts; never this wallet */
        safeOptions(): { label: string, value: string }[] {
            const own = new Set((this.wallet?.meta.addresses || []).map(a => a.toLowerCase()))
            const opts = [
                ...this.wallets.filter(w => w.id !== this.walletId).flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${short(a)}`, value: a }))),
                ...this.contacts.map(c => ({ label: `${c.name} · ${short(c.address)}`, value: c.address }))
            ].filter(o => !own.has(o.value.toLowerCase()))
            const cur = prefs.safeAddress
            if (cur && !opts.some(o => o.value.toLowerCase() === cur.toLowerCase())) opts.unshift({ label: short(cur), value: cur })
            return opts
        },
        todo(): Step[] {
            return this.steps.filter(s => s.clauses.length && !s.sent)
        }
    },
    watch: {
        walletId() { void this.load() },
        'prefs.safeAddress'() { void this.load() }
    },
    async created() {
        const [wallets, contacts] = await Promise.all([this.$svc.wallet.all(), this.$svc.config.getContacts()])
        this.wallets = wallets
        this.contacts = contacts
        const signable = wallets.filter(canSign)
        this.walletId = ((this.wid && signable.find(w => String(w.id) === this.wid)) || selectedWallet(signable))?.id ?? null
        if (this.walletId === null) this.loading = false
    },
    methods: {
        addSafe(v: string, done: (item?: string) => void) {
            const t = v.trim()
            if (!isAddress(t)) {
                this.safeError = this.$t('panic.error_address')
                done()
                return
            }
            this.setSafe(t)
            done()
        },
        setSafe(v: string | null) {
            this.safeError = ''
            const t = (v || '').trim()
            if (t && (this.wallet?.meta.addresses || []).some(a => a.toLowerCase() === t.toLowerCase())) {
                this.safeError = this.$t('panic.error_same')
                return
            }
            prefs.safeAddress = t ? addr.toChecksumed(t) : ''
        },
        describe(s: Step): string {
            const bits: string[] = []
            if (s.revokes) bits.push(this.$t('panic.label_revokes', { n: s.revokes }))
            if (s.parts.length) bits.push(this.$t('panic.label_moves', { what: s.parts.join(', ') }))
            return bits.length ? bits.join(' · ') : this.$t('panic.label_clean')
        },
        async load() {
            const w = this.wallet
            if (!w) return
            this.loading = true
            const bc = this.$svc.bc(w.gid)
            const safe = prefs.safeAddress
            try {
                this.steps = await Promise.all(w.meta.addresses.map(async (address, index): Promise<Step> => {
                    const approvals = await findApprovals(bc.thor, address).catch(() => [])
                    const revokes = approvals.map(revokeClause)
                    let sweep = { clauses: [] as Clause[], parts: [] as string[] }
                    if (safe) {
                        const specs = await visibleTokens(this.$svc, w.gid, address)
                        const balances = await Promise.all(specs.map(s => bc.balanceOf(address, s).then(b => BigInt(new BigNumber(b).toFixed(0))).catch(() => 0n)))
                        sweep = sweepClauses(specs, balances, safe)
                    }
                    // revoking first: if it runs out of gas, the approvals are what matters most
                    return { index, address, revokes: revokes.length, parts: sweep.parts, clauses: [...revokes, ...sweep.clauses], sent: false }
                }))
            } finally {
                this.loading = false
            }
        },
        async run() {
            const w = this.wallet
            if (!w) return
            try {
                await new Promise<void>((resolve, reject) => {
                    this.$q.dialog({
                        title: this.$t('panic.title_confirm'),
                        message: prefs.safeAddress
                            ? this.$t('panic.msg_confirm_move', { to: short(prefs.safeAddress) })
                            : this.$t('panic.msg_confirm_revoke'),
                        cancel: true,
                        ok: { label: this.$t('panic.action_confirm'), color: 'negative', unelevated: true, noCaps: true }
                    }).onOk(() => resolve()).onCancel(() => reject(new Error('cancelled')))
                })
            } catch {
                return
            }
            haptic('warning')
            this.working = true
            let done = 0
            try {
                const list = this.todo
                for (const [n, s] of list.entries()) {
                    this.progress = list.length > 1 ? this.$t('payout.label_batch', { n: n + 1, of: list.length }) : ''
                    const comment = this.$t('panic.comment')
                    await this.$signTx(w.gid, {
                        message: s.clauses.map(c => ({ ...c, comment })),
                        options: { signer: s.address, comment }
                    })
                    s.sent = true
                    done++
                }
            } catch {
                // declined: what was signed is on its way
            } finally {
                this.working = false
                this.progress = ''
            }
            if (done) {
                this.$dialog({ component: SuccessDialog, title: this.$t('panic.title_done'), message: this.$t('panic.msg_done') }).catch(() => { })
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.panic-intro
  border-color: rgba(248, 113, 113, 0.45)
  background: rgba(248, 113, 113, 0.06)
</style>
