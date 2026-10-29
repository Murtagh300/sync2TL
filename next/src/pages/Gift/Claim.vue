<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="mine ? $t('gift.title_reclaim') : $t('gift.title_claim')" />
        <page-content
            class="col"
            padding
        >
            <div
                v-if="!sk"
                class="text-center q-py-xl text-soft"
            >{{$t('gift.msg_bad_link')}}</div>
            <template v-else>
                <div class="column items-center text-center q-mb-lg">
                    <q-icon
                        :name="done ? 'check_circle' : 'o_redeem'"
                        size="56px"
                        color="primary"
                    />
                    <div
                        v-if="n && !mine"
                        class="note q-mt-sm"
                    >“{{n}}”</div>
                </div>
                <q-skeleton
                    v-if="loading"
                    height="90px"
                />
                <template v-else>
                    <div
                        v-if="!parts.length"
                        class="text-center text-soft q-mb-md"
                    >{{done ? $t('gift.msg_claimed') : $t('gift.msg_empty')}}</div>
                    <div
                        v-else
                        class="bvm-tile q-pa-md q-mb-md text-center"
                    >
                        <div class="text-muted">{{$t('gift.label_in_link')}}</div>
                        <div
                            v-for="p in parts"
                            :key="p"
                            class="bvm-display amount"
                        >{{p}}</div>
                    </div>
                    <template v-if="parts.length && !done">
                        <q-select
                            v-if="destinations.length"
                            v-model="to"
                            :options="destinations"
                            emit-value
                            map-options
                            outlined
                            dense
                            :label="$t('gift.label_to')"
                        />
                        <div
                            v-else
                            class="bvm-tile q-pa-md text-center"
                        >
                            <p class="text-soft">{{$t('gift.msg_need_wallet')}}</p>
                            <q-btn
                                unelevated
                                no-caps
                                color="primary"
                                :label="$t('gift.action_make_wallet')"
                                @click="makeWallet()"
                            />
                        </div>
                    </template>
                    <p
                        v-if="error"
                        class="text-negative q-mt-md"
                    >{{error}}</p>
                </template>
            </template>
        </page-content>
        <page-action v-if="sk && parts.length && !done && destinations.length">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                :loading="working"
                :disable="!to"
                :label="mine ? $t('gift.action_reclaim') : $t('gift.action_claim')"
                @click="claim()"
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
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { claimClauses, giftAddress, giftKeyFrom, gifts, signedClaim, type Gift } from 'src/utils/gift'
import { estimateGas, calcFee } from 'pages/Sign/helper'

const PENDING = 'bv-pending-claim'

// a money link opened: what it holds, moved into one of your addresses with the link's own key
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction },
    props: {
        k: { type: String, default: '' },
        /** the sender's note */
        n: { type: String, default: '' }
    },
    data: () => ({
        wallets: [] as M.Wallet[],
        specs: [] as M.TokenSpec[],
        balances: [] as bigint[],
        to: '',
        loading: true,
        working: false,
        done: false,
        error: ''
    }),
    computed: {
        sk(): Buffer | null {
            let saved = ''
            try {
                saved = sessionStorage.getItem(PENDING) || ''
            } catch { }
            return giftKeyFrom(this.k || saved)
        },
        address(): string {
            return this.sk ? giftAddress(this.sk) : ''
        },
        /** this device made the link: then this takes it back */
        gift(): Gift | undefined {
            return gifts.list.find(g => g.address.toLowerCase() === this.address.toLowerCase())
        },
        mine(): boolean {
            return !!this.gift
        },
        destinations(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id)
                .flatMap(w => w.meta.addresses.map((a, i) => ({ label: `${w.meta.name} #${i + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        /** what is there, VTHO under the fee reserve left out */
        parts(): string[] {
            return claimClauses(this.specs, this.balances, this.to || this.address, 2n * 10n ** 18n).parts
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id))
        this.to = this.gift?.from || w?.meta.addresses[0] || this.destinations[0]?.value || ''
        await this.load()
    },
    methods: {
        async load() {
            if (!this.sk) return
            this.loading = true
            try {
                const bc = this.$svc.bc(genesises.main.id)
                this.specs = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id)
                this.balances = await Promise.all(this.specs.map(s => bc.balanceOf(this.address, s).then(b => BigInt(new BigNumber(b).toFixed(0))).catch(() => 0n)))
            } finally {
                this.loading = false
            }
        },
        /** no wallet yet: make one, and come back to this link */
        makeWallet() {
            try {
                sessionStorage.setItem(PENDING, this.sk!.toString('hex'))
            } catch { }
            void this.$router.push({ name: 'new-wallet' })
        },
        async claim() {
            const sk = this.sk
            if (!sk || !this.to) return
            this.working = true
            this.error = ''
            try {
                const bc = this.$svc.bc(genesises.main.id)
                const thor = bc.thor
                // a first guess for the fee, then the clauses that leave exactly enough VTHO for it
                const first = claimClauses(this.specs, this.balances, this.to, 2n * 10n ** 18n).clauses
                const est = await estimateGas(thor, first, 0, this.address)
                if (est.reverted) throw new Error(est.vmError || 'reverted')
                const fee = BigInt(calcFee(est.gas, est.baseGasPrice, 0).toFixed(0))
                const { clauses } = claimClauses(this.specs, this.balances, this.to, fee)
                const raw = signedClaim(sk, {
                    chainTag: Number.parseInt(thor.genesis.id.slice(-2), 16),
                    blockRef: thor.status.head.id.slice(0, 18),
                    clauses,
                    gas: est.gas
                })
                const r = await fetch(new URL('transactions', bc.nodeUrl).href, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ raw }) })
                if (!r.ok) throw new Error(await r.text())
                const { id } = await r.json() as { id: string }
                // until it is in a block
                for (let i = 0; i < 20; i++) {
                    await new Promise(res => setTimeout(res, 3000))
                    const receipt = await thor.transaction(id).getReceipt().catch(() => null)
                    if (receipt) {
                        if (receipt.reverted) throw new Error('reverted')
                        break
                    }
                }
                this.done = true
                if (this.gift) this.gift.reclaimed = true
                try {
                    sessionStorage.removeItem(PENDING)
                } catch { }
                await this.load()
            } catch (err) {
                console.warn('claim:', err)
                this.error = this.$t('gift.msg_claim_failed')
            } finally {
                this.working = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.note
  font-size: 18px
  max-width: 340px

.amount
  font-size: 26px
</style>
