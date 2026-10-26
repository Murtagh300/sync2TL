<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('consolidate.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('consolidate.msg_intro')}}</p>
            <empty-state
                v-if="!wallet || wallet.meta.addresses.length < 2"
                icon="o_call_merge"
                :text="$t('consolidate.msg_one_address')"
            />
            <template v-else>
                <q-select
                    v-model="target"
                    :options="wallet.meta.addresses.map((a, k) => ({ label: `#${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: k }))"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('consolidate.label_target')"
                    class="q-mb-md"
                />
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
                    role="group"
                    v-else
                    class="bvm-list"
                >
                    <q-item
                        v-for="s in sources"
                        :key="s.index"
                    >
                        <q-item-section>
                            <q-item-label class="text-weight-bold">#{{s.index + 1}} <address-label :addr="s.address" /></q-item-label>
                            <q-item-label
                                v-if="s.parts.length"
                                caption
                            >{{s.parts.join(' · ')}}</q-item-label>
                            <q-item-label
                                v-else
                                caption
                            >{{$t('consolidate.label_empty')}}</q-item-label>
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
                <p class="text-caption text-muted q-mt-md">{{$t('consolidate.msg_vtho', { n: RESERVE_VTHO })}}</p>
            </template>
        </page-content>
        <page-action v-if="wallet && wallet.meta.addresses.length > 1">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_call_merge"
                :loading="working"
                :disable="loading || !movable.length"
                :label="progress || $t('consolidate.action', { n: movable.length, to: target + 1 })"
                @click="run()"
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
import EmptyState from 'components/EmptyState.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { visibleTokens } from 'src/utils/tokens'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatUnits } from 'src/utils/format'
import { fns } from 'src/utils/actions'

/** VTHO left behind on each address: its own transaction pays its fee */
const RESERVE_VTHO = 10

type Source = { index: number, address: string, parts: string[], clauses: { to: string, value: string, data: string }[], sent: boolean }

// move everything from a wallet's other addresses to one of them
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel, EmptyState },
    props: {
        wid: String
    },
    data: () => ({
        RESERVE_VTHO,
        wallets: [] as M.Wallet[],
        target: 0,
        sources: [] as Source[],
        loading: true,
        working: false,
        progress: ''
    }),
    computed: {
        wallet(): M.Wallet | null {
            const signable = this.wallets.filter(canSign)
            return (this.wid && signable.find(w => String(w.id) === this.wid)) || selectedWallet(signable)
        },
        movable(): Source[] {
            return this.sources.filter(s => s.clauses.length && !s.sent)
        }
    },
    watch: {
        target() { void this.load() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        await this.load()
    },
    methods: {
        async load() {
            const w = this.wallet
            if (!w || w.meta.addresses.length < 2) {
                this.loading = false
                return
            }
            this.loading = true
            const to = w.meta.addresses[this.target]!
            const bc = this.$svc.bc(w.gid)
            try {
                this.sources = await Promise.all(w.meta.addresses.map(async (address, index) => {
                    const source: Source = { index, address, parts: [], clauses: [], sent: false }
                    if (index === this.target) return source
                    const specs = await visibleTokens(this.$svc, w.gid, address)
                    const balances = await Promise.all(specs.map(s => bc.balanceOf(address, s).then(b => BigInt(new BigNumber(b).toFixed(0))).catch(() => 0n)))
                    let vet = 0n
                    let vtho = 0n
                    specs.forEach((spec, k) => {
                        const b = balances[k]!
                        if (b <= 0n) return
                        if (spec.symbol === 'VET') vet = b
                        else if (spec.symbol === 'VTHO') vtho = b
                        else {
                            source.clauses.push({ to: spec.address, value: '0', data: fns.transfer.encode(to, b.toString()) })
                            source.parts.push(`${formatUnits(b, spec.decimals, 2)} ${spec.symbol}`)
                        }
                    })
                    if (vet > 0n) {
                        source.clauses.push({ to, value: vet.toString(), data: '0x' })
                        source.parts.unshift(`${formatUnits(vet, 18, 2)} VET`)
                    }
                    const reserve = BigInt(RESERVE_VTHO) * 10n ** 18n
                    const vthoSpec = specs.find(s => s.symbol === 'VTHO')
                    if (vthoSpec && vtho > reserve) {
                        source.clauses.push({ to: vthoSpec.address, value: '0', data: fns.transfer.encode(to, (vtho - reserve).toString()) })
                        source.parts.push(`${formatUnits(vtho - reserve, 18, 2)} VTHO`)
                    }
                    return source
                }))
                this.sources = this.sources.filter(s => s.index !== this.target)
            } finally {
                this.loading = false
            }
        },
        async run() {
            const w = this.wallet
            if (!w) return
            const to = w.meta.addresses[this.target]!
            this.working = true
            let moved = 0
            try {
                const list = this.movable
                for (const [n, s] of list.entries()) {
                    this.progress = list.length > 1 ? this.$t('payout.label_batch', { n: n + 1, of: list.length }) : ''
                    const comment = this.$t('consolidate.comment', { from: s.index + 1, to: this.target + 1 })
                    await this.$signTx(w.gid, {
                        message: s.clauses.map(c => ({ ...c, comment })),
                        options: { signer: s.address, comment }
                    })
                    s.sent = true
                    moved++
                }
            } catch {
                // declined: what was signed is on its way
            } finally {
                this.working = false
                this.progress = ''
            }
            if (moved) {
                this.$dialog({ component: SuccessDialog, title: this.$t('consolidate.title_done'), message: this.$t('consolidate.msg_done', { n: moved, to: `${to.slice(0, 6)}…${to.slice(-4)}` }) }).catch(() => { })
            }
        }
    }
})
</script>
