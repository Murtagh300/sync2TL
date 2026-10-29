<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('tank.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('tank.msg_intro')}}</p>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 2"
                    :key="i"
                    height="120px"
                />
            </div>
            <template v-else>
                <div
                    v-for="r in rows"
                    :key="r.address"
                    class="bvm-tile q-pa-md q-mb-md"
                >
                    <div class="row no-wrap items-center">
                        <div class="col ellipsis text-weight-bold">{{r.name}}</div>
                        <div class="text-muted">{{fmt(r.vtho)}} VTHO</div>
                    </div>
                    <div class="tank q-mt-sm">
                        <div
                            class="tank-fill"
                            :class="r.left < LOW_TX ? 'tank-fill--low' : ''"
                            :style="{ width: `${Math.min(100, r.left / FULL * 100)}%` }"
                        />
                    </div>
                    <div class="row justify-between q-mt-xs">
                        <span :class="r.left < LOW_TX ? 'text-warning text-weight-bold' : 'text-soft'">{{$t('tank.label_left', { n: r.left })}}</span>
                        <span class="text-caption text-muted">{{$t('tank.label_fee', { fee: fmt(r.fee, 2) })}}</span>
                    </div>
                    <div
                        v-if="r.left < LOW_TX"
                        class="row q-gutter-sm q-mt-sm"
                    >
                        <q-btn
                            unelevated
                            dense
                            no-caps
                            color="primary"
                            class="q-px-sm"
                            :label="$t('sign.action_get_vtho')"
                            @click="swap(r, 'VET', 'VTHO')"
                        />
                        <span class="text-caption text-muted self-center">{{$t('tank.msg_low_options')}}</span>
                    </div>
                    <div
                        v-else-if="r.surplus"
                        class="row no-wrap items-center q-mt-sm"
                    >
                        <div class="col text-caption text-muted">{{$t('tank.msg_surplus', { n: fmt(r.surplus, 0), keep: keep })}}</div>
                        <q-btn
                            outline
                            dense
                            no-caps
                            color="primary"
                            class="q-px-sm"
                            :label="$t('tank.action_swap', { n: fmt(r.surplus, 0) })"
                            @click="swap(r, 'VTHO', 'VET', r.surplus)"
                        />
                    </div>
                </div>
                <q-input
                    v-model.number="keep"
                    outlined
                    dense
                    type="number"
                    min="0"
                    :label="$t('tank.label_keep')"
                    :hint="$t('tank.hint_keep')"
                    suffix="VTHO"
                />
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import { genesises } from 'src/consts'
import { canSign } from 'src/utils/watch'
import { numberLocale } from 'src/utils/format'
import { prefs } from 'src/utils/prefs'
import { averageFee, LOW_TX, surplus, txLeft } from 'src/utils/vtho-tank'

type Row = { walletId: number, index: number, address: string, name: string, vtho: number, fee: number, left: number, surplus: number }

/** a tank this many transactions deep shows full */
const FULL = 50

// VTHO as fuel: transactions left per address, and the surplus to VET
export default defineComponent({
    components: { PageToolbar, PageContent },
    data: () => ({
        loading: true,
        LOW_TX,
        FULL,
        list: [] as Omit<Row, 'surplus'>[]
    }),
    computed: {
        keep: {
            get(): number {
                return prefs.vthoKeep
            },
            set(v: number) {
                prefs.vthoKeep = Math.max(0, Number(v) || 0)
            }
        },
        rows(): Row[] {
            return this.list.map(r => ({ ...r, surplus: surplus(r.vtho, this.keep) }))
        }
    },
    async created() {
        try {
            const [wallets, activity] = await Promise.all([this.$svc.wallet.all(), this.$svc.activity.page(1000, 0)])
            const bc = this.$svc.bc(genesises.main.id)
            const out: Omit<Row, 'surplus'>[] = []
            for (const w of wallets.filter(x => x.gid === genesises.main.id && canSign(x))) {
                for (const [index, address] of w.meta.addresses.entries()) {
                    const acc = await bc.thor.account(address).get().catch(() => null)
                    const vtho = acc ? new BigNumber(acc.energy).div(1e18).toNumber() : 0
                    const fee = averageFee(activity, address)
                    out.push({ walletId: w.id, index, address, name: `${w.meta.name} #${index + 1}`, vtho, fee, left: txLeft(vtho, fee) })
                }
            }
            this.list = out
        } finally {
            this.loading = false
        }
    },
    methods: {
        fmt(n: number, digits = 2) {
            return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: digits }).format(n)
        },
        swap(r: Row, from: string, to: string, amount?: number) {
            void this.$router.push({ name: 'swap', query: { wid: String(r.walletId), i: String(r.index), from, to, ...(amount ? { amt: String(amount) } : {}) } })
        }
    }
})
</script>
<style lang="sass" scoped>
.tank
  height: 10px
  border-radius: 999px
  background: rgba(255, 255, 255, 0.07)
  overflow: hidden

.tank-fill
  height: 100%
  border-radius: 999px
  background: var(--q-primary)

.tank-fill--low
  background: var(--q-warning)
</style>
