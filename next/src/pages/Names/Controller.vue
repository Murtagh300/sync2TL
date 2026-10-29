<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('vetname.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('vetname.msg_intro')}}</p>
            <q-select
                v-if="addresses.length > 1 && !pending"
                v-model="owner"
                :options="addresses"
                emit-value
                map-options
                outlined
                dense
                :label="$t('vetname.label_owner')"
                class="q-mb-md"
            />

            <!-- a registration halfway: step 2 -->
            <div
                v-if="pending"
                class="bvm-tile q-pa-md q-mb-md"
            >
                <div class="text-weight-bold bvm-display name-big">{{pending.label}}.vet</div>
                <div class="text-caption text-muted q-mb-sm">{{$t('vetname.label_for', { years: pending.years })}} · <address-label :addr="pending.owner" /></div>
                <q-linear-progress
                    :value="waitLeft > 0 ? 1 - waitLeft / WAIT_SECONDS : 1"
                    color="primary"
                    rounded
                    class="q-mb-sm"
                />
                <div class="text-soft">{{waitLeft > 0 ? $t('vetname.msg_waiting', { n: waitLeft }) : $t('vetname.msg_ready')}}</div>
                <q-btn
                    flat
                    dense
                    no-caps
                    color="grey-5"
                    class="q-mt-sm"
                    :label="$t('vetname.action_cancel')"
                    @click="cancel()"
                />
            </div>

            <template v-else>
                <q-input
                    v-model="input"
                    outlined
                    autofocus
                    suffix=".vet"
                    :label="$t('vetname.label_name')"
                    autocapitalize="off"
                    autocomplete="off"
                    spellcheck="false"
                    :loading="quoting"
                    class="q-mb-sm"
                />
                <div
                    v-if="quote && label"
                    class="bvm-tile q-pa-md q-mb-md"
                >
                    <div class="row items-center no-wrap">
                        <q-icon
                            :name="quote.available ? 'check_circle' : 'o_cancel'"
                            :color="quote.available ? 'primary' : 'negative'"
                            size="22px"
                            class="q-mr-sm"
                        />
                        <span class="text-weight-bold">{{quote.available ? $t('vetname.label_available', { name: `${label}.vet` }) : quote.valid ? $t('vetname.label_taken', { name: `${label}.vet` }) : $t('vetname.label_invalid')}}</span>
                    </div>
                    <template v-if="quote.available">
                        <q-btn-toggle
                            v-model="years"
                            :options="[1, 2, 3, 5].map(y => ({ label: $t('vetname.label_years', { n: y }, y), value: y }))"
                            spread
                            no-caps
                            unelevated
                            toggle-color="primary"
                            color="dark"
                            class="q-mt-md"
                        />
                        <div class="row items-baseline q-mt-md">
                            <span class="text-muted">{{$t('vetname.label_price')}}</span>
                            <q-space />
                            <span class="bvm-amount">{{formatUnits(quote.price, 18, 0)}} VET</span>
                            <span
                                v-if="fiat"
                                class="text-muted q-ml-sm"
                            >≈ {{fiat}}</span>
                        </div>
                        <q-toggle
                            v-model="primary"
                            :label="$t('vetname.label_primary')"
                            class="q-mt-sm"
                        />
                    </template>
                </div>
            </template>
            <p class="text-caption text-muted">{{$t('vetname.msg_how')}}</p>
        </page-content>
        <page-action v-if="owner">
            <q-btn
                v-if="pending"
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_verified"
                :loading="working"
                :disable="waitLeft > 0 || working"
                :label="$t('vetname.action_register', { name: `${pending.label}.vet` })"
                @click="register()"
            />
            <q-btn
                v-else
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_lock_clock"
                :loading="working"
                :disable="!quote?.available || !canSign || working"
                :label="$t('vetname.action_commit')"
                @click="commit()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import AddressLabel from 'components/AddressLabel.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatUnits } from 'src/utils/format'
import { money, prefs } from 'src/utils/prefs'
import { nameOf } from 'src/utils/names'
import { cleanLabel, commitClause, loadPending, newSecret, quoteName, registerClause, savePending, type NameQuote, type Pending } from 'src/utils/vet-names'

/** seconds between commit and register: the contract wants 10, a block or two more to be safe */
const WAIT_SECONDS = 25

// register a .vet name: commit, wait a moment, register (vet.domains)
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel },
    data: () => ({
        WAIT_SECONDS,
        wallets: [] as M.Wallet[],
        owner: '',
        input: '',
        years: 1,
        primary: true,
        quote: null as NameQuote | null,
        quoting: false,
        vetPrice: 0,
        fx: 1,
        pending: loadPending() as Pending | null,
        now: Date.now(),
        working: false,
        timer: null as ReturnType<typeof setTimeout> | null,
        clock: null as ReturnType<typeof setInterval> | null
    }),
    computed: {
        thor(): Connex.Thor { return this.$svc.bc(genesises.main.id).thor },
        signable(): M.Wallet[] {
            return this.wallets.filter(w => w.gid === genesises.main.id && canSign(w))
        },
        addresses(): { label: string, value: string }[] {
            return this.signable.flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        canSign(): boolean {
            return this.addresses.some(a => a.value === this.owner)
        },
        label(): string {
            return cleanLabel(this.input)
        },
        fiat(): string {
            if (!this.quote || !this.vetPrice) return ''
            return money(new BigNumber(this.quote.price.toString()).div(1e18).toNumber() * this.vetPrice * this.fx)
        },
        waitLeft(): number {
            if (!this.pending || !this.pending.committedAt) return WAIT_SECONDS
            return Math.max(0, Math.ceil((this.pending.committedAt + WAIT_SECONDS * 1000 - this.now) / 1000))
        }
    },
    watch: {
        label() { this.requote() },
        years() { this.requote() },
        owner(a: string) {
            // a second name for an address that has one: not its primary by default
            this.primary = !nameOf(a)
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.signable)
        this.owner = this.pending?.owner || w?.meta.addresses[0] || this.addresses[0]?.value || ''
        this.clock = setInterval(() => { this.now = Date.now() }, 1000)
        const [stats, fx] = await Promise.all([this.$svc.prices.stats([null]).catch(() => ({} as Record<string, { price: number }>)), this.$svc.prices.fx(prefs.currency).catch(() => 1)])
        this.vetPrice = stats['0x0000000000000000000000000000000000000000']?.price || 0
        this.fx = fx
    },
    beforeUnmount() {
        this.clock && clearInterval(this.clock)
        this.timer && clearTimeout(this.timer)
    },
    methods: {
        formatUnits,
        requote() {
            this.quote = null
            this.timer && clearTimeout(this.timer)
            if (!this.label) return
            this.quoting = true
            const label = this.label
            const years = this.years
            this.timer = setTimeout(() => {
                quoteName(this.thor, label, years)
                    .then(q => { if (label === this.label && years === this.years) this.quote = q })
                    .catch(() => { })
                    .finally(() => { this.quoting = false })
            }, 400)
        },
        async waitForReceipt(txid: string): Promise<boolean> {
            for (let i = 0; i < 30; i++) {
                const r = await this.thor.transaction(txid).getReceipt().catch(() => null)
                if (r) return !r.reverted
                await new Promise(resolve => setTimeout(resolve, 4000))
            }
            return false
        },
        async commit() {
            const q = this.quote
            if (!q?.available || !this.canSign) return
            const p: Pending = { label: q.label, owner: this.owner, years: this.years, secret: newSecret(), primary: this.primary, committedAt: 0, txid: '' }
            const comment = this.$t('vetname.comment_commit', { name: `${p.label}.vet` })
            this.working = true
            try {
                const res = await this.$signTx(genesises.main.id, {
                    message: [{ ...commitClause(p), comment }],
                    options: { signer: p.owner, comment }
                })
                // kept before the wait: the secret is what step 2 needs
                p.txid = res.txid
                savePending(p)
                this.pending = p
                if (await this.waitForReceipt(res.txid)) {
                    p.committedAt = Date.now()
                    savePending(p)
                    this.pending = { ...p }
                } else {
                    this.$q.notify({ message: this.$t('vetname.msg_commit_failed'), color: 'negative' })
                    this.cancel()
                }
            } catch {
                // declined
            } finally {
                this.working = false
            }
        },
        async register() {
            const p = this.pending
            if (!p) return
            this.working = true
            try {
                // the price again: it follows VET's price
                const q = await quoteName(this.thor, p.label, p.years)
                if (!q.available) {
                    this.$q.notify({ message: this.$t('vetname.label_taken', { name: `${p.label}.vet` }), color: 'negative' })
                    this.cancel()
                    return
                }
                const comment = this.$t('vetname.comment_register', { name: `${p.label}.vet`, years: p.years })
                const res = await this.$signTx(genesises.main.id, {
                    message: [{ ...registerClause(p, q.price), comment }],
                    options: { signer: p.owner, comment }
                })
                const ok = await this.waitForReceipt(res.txid)
                if (!ok) {
                    this.$q.notify({ message: this.$t('vetname.msg_register_failed'), color: 'negative' })
                    return
                }
                this.cancel()
                this.input = ''
                this.$dialog({ component: SuccessDialog, title: this.$t('vetname.title_done', { name: `${p.label}.vet` }), message: this.$t('vetname.msg_done') }).catch(() => { })
            } catch {
                // declined: the commit stays usable for a day
            } finally {
                this.working = false
            }
        },
        cancel() {
            savePending(null)
            this.pending = null
        }
    }
})
</script>
<style lang="sass" scoped>
.name-big
  font-size: 22px
  word-break: break-all
</style>
