<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('dust.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('dust.msg_intro')}}</p>
            <div class="row items-center q-mb-md">
                <span class="text-muted q-mr-sm">{{$t('dust.label_below')}}</span>
                <q-btn-toggle
                    v-model="threshold"
                    dense
                    no-caps
                    unelevated
                    toggle-color="primary"
                    color="dark"
                    :options="[1, 5, 10, 25].map(v => ({ label: money(v), value: v }))"
                />
            </div>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 3"
                    :key="i"
                    height="56px"
                />
            </div>
            <empty-state
                v-else-if="!rows.length"
                icon="o_cleaning_services"
                :text="$t('dust.msg_none')"
            />
            <q-list
                role="group"
                v-else
                class="bvm-list"
            >
                <q-item
                    v-for="r in rows"
                    :key="r.spec.symbol"
                    tag="label"
                    :disable="r.value === null"
                >
                    <q-item-section side>
                        <q-checkbox
                            v-model="selected"
                            :val="r.spec.symbol"
                            :disable="r.value === null"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label class="text-weight-bold">{{r.spec.symbol}}</q-item-label>
                        <q-item-label caption>{{formatUnits(r.balance, r.spec.decimals)}}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <span
                            v-if="r.value !== null"
                            class="bvm-amount"
                        >{{money(r.value)}}</span>
                        <span
                            v-else
                            class="text-caption text-muted"
                        >{{$t('dust.label_no_price')}}</span>
                        <span
                            v-if="failed.includes(r.spec.symbol)"
                            class="text-caption text-negative"
                        >{{$t('swap.msg_no_route')}}</span>
                    </q-item-section>
                </q-item>
            </q-list>
        </page-content>
        <page-action v-if="wallet">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_cleaning_services"
                :loading="working"
                :disable="!selected.length"
                :label="$t('dust.action_convert', { n: selected.length })"
                @click="convert()"
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
import EmptyState from 'components/EmptyState.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { quote, type Clause } from 'src/utils/swap'
import { visibleTokens } from 'src/utils/tokens'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatUnits } from 'src/utils/format'
import { money, prefs } from 'src/utils/prefs'
import { ZERO_ADDRESS } from 'src/utils/actions'
import { genesises } from 'src/consts'

type Row = { spec: M.TokenSpec, balance: bigint, value: number | null }

// small token balances, swapped to VET in one transaction
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, EmptyState },
    props: {
        wid: String,
        i: String
    },
    data: () => ({
        wallets: [] as M.Wallet[],
        all: [] as Row[],
        threshold: 5,
        selected: [] as string[],
        failed: [] as string[],
        loading: true,
        working: false
    }),
    computed: {
        wallet(): M.Wallet | null {
            const signable = this.wallets.filter(w => canSign(w) && w.gid === genesises.main.id)
            return (this.wid && signable.find(w => String(w.id) === this.wid)) || selectedWallet(signable)
        },
        address(): string {
            return this.wallet?.meta.addresses[parseInt(this.i || '0')] || ''
        },
        /** below the threshold (or without a price: shown, not selectable) */
        rows(): Row[] {
            return this.all.filter(r => r.value === null || r.value < this.threshold)
        }
    },
    watch: {
        threshold() { this.preselect() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        await this.load()
    },
    methods: {
        formatUnits,
        money(v: number) {
            return money(v)
        },
        preselect() {
            this.selected = this.rows.filter(r => r.value !== null).map(r => r.spec.symbol)
        },
        async load() {
            const w = this.wallet
            if (!w || !this.address) {
                this.loading = false
                return
            }
            this.loading = true
            try {
                const specs = (await visibleTokens(this.$svc, w.gid, this.address))
                    // VET is where they go; VTHO pays the fees
                    .filter(s => s.symbol !== 'VET' && s.symbol !== 'VTHO')
                const [balances, stats, fx] = await Promise.all([
                    Promise.all(specs.map(s => this.$svc.bc(w.gid).balanceOf(this.address, s).catch(() => '0'))),
                    this.$svc.prices.stats(specs.map(s => s.address)).catch(() => ({} as Record<string, { price: number }>)),
                    this.$svc.prices.fx(prefs.currency)
                ])
                this.all = specs.map((spec, k) => {
                    const balance = BigInt(new BigNumber(balances[k]!).toFixed(0))
                    const price = stats[spec.address.toLowerCase()]?.price
                    const units = new BigNumber(balance.toString()).div(new BigNumber(10).pow(spec.decimals)).toNumber()
                    return { spec, balance, value: price !== undefined ? units * price * fx : null }
                }).filter(r => r.balance > 0n)
                this.preselect()
            } finally {
                this.loading = false
            }
        },
        async convert() {
            const w = this.wallet
            if (!w) return
            this.working = true
            this.failed = []
            const clauses: Clause[] = []
            let out = 0n
            const done: string[] = []
            try {
                const thor = this.$svc.bc(w.gid).thor
                for (const r of this.rows.filter(x => this.selected.includes(x.spec.symbol))) {
                    try {
                        // 3%: small pools move more, and these are small amounts
                        const q = await quote(thor, r.spec.address, ZERO_ADDRESS, r.balance, 300, this.address)
                        clauses.push(...q.clauses)
                        out += q.amountOutMin
                        done.push(r.spec.symbol)
                    } catch {
                        this.failed.push(r.spec.symbol)
                    }
                }
                if (!clauses.length) return
                const comment = this.$t('dust.comment', { n: done.length, vet: formatUnits(out, 18, 2) })
                await this.$signTx(w.gid, {
                    message: clauses.map(c => ({ ...c, comment })),
                    options: { signer: this.address, comment }
                })
                this.$dialog({ component: SuccessDialog, title: this.$t('dust.title_done'), message: this.$t('dust.msg_done', { vet: formatUnits(out, 18, 2) }) }).catch(() => { })
                setTimeout(() => void this.load(), 12 * 1000)
            } catch {
                // declined
            } finally {
                this.working = false
            }
        }
    }
})
</script>
