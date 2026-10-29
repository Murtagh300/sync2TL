<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <q-card-section>
                <div class="bvm-display pool-title">{{mode === 'add' ? $t('liquidity.title_add', { pair }) : $t('liquidity.title_remove', { pair })}}</div>
                <p class="text-soft q-mb-md">{{mode === 'add' ? $t('liquidity.msg_add') : $t('liquidity.msg_remove')}}</p>
                <template v-if="mode === 'add'">
                    <q-input
                        v-model="amountText"
                        outlined
                        dense
                        inputmode="decimal"
                        :label="pool.token0.symbol || 'VET'"
                        :hint="$t('liquidity.label_balance', { amount: fmt(balance0, pool.token0.decimals) })"
                    >
                        <template #append>
                            <q-btn
                                flat
                                dense
                                no-caps
                                color="primary"
                                :label="$t('swap.action_max')"
                                @click="max()"
                            />
                        </template>
                    </q-input>
                    <div class="row items-center no-wrap q-mt-md">
                        <q-icon
                            name="o_add"
                            class="q-mr-sm text-muted"
                        />
                        <div class="col">
                            <div class="bvm-amount">{{fmt(amount1, pool.token1.decimals)}} {{pool.token1.symbol || 'VET'}}</div>
                            <div class="text-caption text-muted">{{$t('liquidity.label_balance', { amount: fmt(balance1, pool.token1.decimals) })}}</div>
                        </div>
                    </div>
                    <div
                        v-if="tooMuch"
                        class="text-caption text-negative q-mt-sm"
                    >{{$t('liquidity.msg_not_enough')}}</div>
                </template>
                <template v-else>
                    <div class="row q-gutter-sm">
                        <q-btn
                            v-for="p in [25, 50, 75, 100]"
                            :key="p"
                            :outline="part !== p"
                            :unelevated="part === p"
                            color="primary"
                            no-caps
                            class="col"
                            :label="`${p}%`"
                            @click="part = p"
                        />
                    </div>
                    <div class="bvm-tile q-pa-md q-mt-md">
                        <div class="text-caption text-muted">{{$t('liquidity.label_you_get')}}</div>
                        <div class="bvm-amount">{{fmt(out.amount0, pool.token0.decimals)}} {{pool.token0.symbol || 'VET'}}</div>
                        <div class="bvm-amount">{{fmt(out.amount1, pool.token1.decimals)}} {{pool.token1.symbol || 'VET'}}</div>
                    </div>
                </template>
                <p class="text-caption text-muted q-mt-sm q-mb-none">{{$t('liquidity.msg_slippage', { pct: SLIPPAGE })}}</p>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md column q-gutter-y-sm">
                <q-btn
                    class="full-width"
                    unelevated
                    no-caps
                    size="lg"
                    color="primary"
                    :disable="!ready"
                    :label="mode === 'add' ? $t('liquidity.action_add') : $t('liquidity.action_remove')"
                    @click="ok()"
                />
                <q-btn
                    class="full-width"
                    flat
                    no-caps
                    :label="$t('common.cancel')"
                    @click="hide()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import { BigNumber } from 'bignumber.js'
import type { Pool } from 'src/utils/liquidity'
import { addClauses, pairAmount, removeClauses, shareOf } from 'src/utils/liquidity-v2'
import { read, vb } from 'src/utils/ecosystem'
import { numberLocale } from 'src/utils/format'
import { genesises } from 'src/consts'

const SLIPPAGE = 1

/** add to or take out of a BetterSwap V2 pool; resolves the clauses to sign */
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        pool: { type: Object as () => Pool, required: true },
        owner: { type: String, required: true },
        mode: { type: String as () => 'add' | 'remove', required: true },
        /** LP tokens held (wei, as a string), for taking out */
        lp: { type: String, default: '0' }
    },
    data: () => ({
        SLIPPAGE,
        amountText: '',
        part: 100,
        balance0: 0n,
        balance1: 0n
    }),
    computed: {
        pair(): string {
            return `${this.pool.token0.symbol || 'VET'}/${this.pool.token1.symbol || 'VET'}`
        },
        amount0(): bigint {
            const v = new BigNumber(this.amountText || '0')
            return v.isFinite() && v.gt(0) ? BigInt(v.shiftedBy(this.pool.token0.decimals).integerValue(BigNumber.ROUND_DOWN).toFixed(0)) : 0n
        },
        amount1(): bigint {
            return pairAmount(this.pool, 0, this.amount0)
        },
        tooMuch(): boolean {
            return this.amount0 > this.balance0 || this.amount1 > this.balance1
        },
        lpOut(): bigint {
            return BigInt(this.lp) * BigInt(this.part) / 100n
        },
        out(): { amount0: bigint, amount1: bigint } {
            return shareOf(this.pool, this.lpOut)
        },
        ready(): boolean {
            return this.mode === 'add' ? this.amount0 > 0n && this.amount1 > 0n && !this.tooMuch : this.lpOut > 0n
        }
    },
    async created() {
        if (this.mode !== 'add') return
        const thor = this.$svc.bc(genesises.main.id).thor
        const of = async (address: string) => {
            if (!address) {
                const acc = await thor.account(this.owner).get()
                return BigInt(acc.balance)
            }
            const [d] = await read(thor, [{ to: address, f: vb.balanceOf, args: [this.owner] }])
            return BigInt(String(d?.balance || 0))
        }
        ;[this.balance0, this.balance1] = await Promise.all([of(this.pool.token0.address), of(this.pool.token1.address)]).catch(() => [0n, 0n])
    },
    methods: {
        fmt(wei: bigint, decimals: number) {
            return new BigNumber(wei.toString()).shiftedBy(-decimals).toNumber().toLocaleString(numberLocale(), { maximumFractionDigits: 4 })
        },
        /** as much as both balances allow, at the pool's ratio */
        max() {
            const byOther = pairAmount(this.pool, 1, this.balance1)
            let a0 = this.balance0 < byOther || byOther === 0n ? this.balance0 : byOther
            // VET pays the fee too: leave a little
            if (!this.pool.token0.address) a0 = a0 > 10n ** 18n ? a0 - 10n ** 18n : 0n
            this.amountText = new BigNumber(a0.toString()).shiftedBy(-this.pool.token0.decimals).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed()
        },
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        ok() {
            const deadline = Math.floor(Date.now() / 1000) + 20 * 60
            const clauses = this.mode === 'add'
                ? addClauses(this.pool, this.owner, this.amount0, this.amount1, SLIPPAGE, deadline)
                : removeClauses(this.pool, this.owner, this.lpOut, SLIPPAGE, deadline)
            this.$emit('ok', clauses)
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
.pool-title
  font-size: 22px
  margin-bottom: 4px
</style>
