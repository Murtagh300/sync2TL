<template>
    <q-dialog
        ref="dialog"
        position="bottom"
        @hide="$emit('hide')"
    >
        <q-card class="full-width stake-card">
            <q-card-section>
                <div class="bvm-display stake-title">{{$t('stargate.title_stake')}}</div>
                <p class="text-soft q-mb-sm">{{$t('stargate.msg_stake')}}</p>
                <q-select
                    v-if="addresses.length > 1"
                    v-model="from"
                    outlined
                    dense
                    emit-value
                    map-options
                    :options="addresses.map(a => ({ label: a.label, value: a.address }))"
                    :label="$t('stargate.label_stake_from')"
                    class="q-mb-sm"
                />
                <div class="text-caption text-muted q-mb-xs">{{$t('stargate.label_balance', { amount: formatUnits(balance, 18, 0) })}}</div>
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
                <q-list
                    v-else
                    role="radiogroup"
                    class="bvm-list"
                >
                    <q-item
                        v-for="l in levels"
                        :key="l.id"
                        tag="label"
                        :disable="!available(l)"
                    >
                        <q-item-section avatar>
                            <q-radio
                                v-model="levelId"
                                :val="l.id"
                                :disable="!available(l)"
                            />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label class="text-weight-bold">{{l.name}}</q-item-label>
                            <q-item-label caption>{{$t('stargate.label_level', { days: l.maturityDays, left: num(Math.max(0, l.cap - l.minted)) })}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-item-label class="bvm-amount">{{formatUnits(l.vet, 18, 0)}} VET</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
                <p class="text-caption text-muted q-mt-sm q-mb-none">{{$t('stargate.msg_stake_next')}}</p>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md column q-gutter-y-sm">
                <q-btn
                    class="full-width"
                    unelevated
                    no-caps
                    size="lg"
                    color="primary"
                    :disable="!chosen"
                    :label="chosen ? $t('stargate.action_stake_amount', { amount: formatUnits(chosen.vet, 18, 0), level: chosen.name }) : $t('stargate.action_stake')"
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
import { stakeLevels, type StakeLevel } from 'src/utils/ecosystem'
import { formatUnits, numberLocale } from 'src/utils/format'
import { genesises } from 'src/consts'

/** a level to stake a new StarGate NFT at, from an address with the VET for it; resolves { from, level } */
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        addresses: { type: Array as () => { address: string, label: string }[], required: true }
    },
    data() {
        return {
            loading: true,
            levels: [] as StakeLevel[],
            levelId: 0,
            from: this.addresses[0]?.address || '',
            balance: 0n
        }
    },
    computed: {
        chosen(): StakeLevel | undefined {
            const l = this.levels.find(x => x.id === this.levelId)
            return l && this.available(l) ? l : undefined
        }
    },
    watch: {
        from: {
            async handler(a: string) {
                const acc = await this.$svc.bc(genesises.main.id).thor.account(a).get().catch(() => null)
                // keep some VET aside for fees paid in VET (and rounding)
                this.balance = acc ? BigInt(acc.balance) : 0n
            },
            immediate: true
        }
    },
    async created() {
        try {
            this.levels = await stakeLevels(this.$svc.bc(genesises.main.id).thor)
        } finally {
            this.loading = false
        }
    },
    methods: {
        formatUnits,
        num(n: number) {
            return n.toLocaleString(numberLocale())
        },
        available(l: StakeLevel) {
            return l.minted < l.cap && l.vet <= this.balance
        },
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        ok() {
            this.$emit('ok', { from: this.from, level: this.chosen })
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
.stake-card
  max-height: 90vh

.stake-title
  font-size: 22px
  margin-bottom: 4px
</style>
