<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('voterRewards.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('voterRewards.msg_intro')}}</p>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 3"
                    :key="i"
                    height="64px"
                />
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <empty-state
                v-else-if="!groups.length"
                icon="o_how_to_vote"
                :text="$t('voterRewards.msg_none', { n: LOOKBACK })"
                :action="$t('vote.action_open')"
                @action="$router.push({ name: 'vote' })"
            />
            <template v-else>
                <div class="bvm-tile total q-mb-md text-center">
                    <div class="text-muted total-label">{{$t('voterRewards.label_total')}}</div>
                    <div class="bvm-amount total-value">{{formatUnits(total, 18, 2)}} B3TR</div>
                    <div
                        v-if="b3trFiat"
                        class="text-muted"
                    >≈ {{money(units(total) * b3trFiat)}}</div>
                </div>
                <div
                    v-for="g in groups"
                    :key="g.address"
                    class="q-mb-lg"
                >
                    <div class="row items-center no-wrap q-pb-sm">
                        <address-label
                            class="bvm-label col ellipsis"
                            :addr="g.address"
                        />
                    </div>
                    <q-list
                        role="list"
                        class="bvm-list"
                    >
                        <q-item
                            v-for="r in g.rewards"
                            :key="r.round"
                        >
                            <q-item-section avatar>
                                <q-icon
                                    name="o_redeem"
                                    color="primary"
                                />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>{{$t('voterRewards.label_round', { n: r.round })}}</q-item-label>
                            </q-item-section>
                            <q-item-section side>
                                <q-item-label class="bvm-amount">{{formatUnits(r.amount, 18, 2)}} B3TR</q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        class="full-width q-mt-sm"
                        icon="o_download"
                        :disable="!g.canSign"
                        :label="$t('voterRewards.action_claim', { amount: formatUnits(g.total, 18, 2) })"
                        @click="claim(g)"
                    />
                    <div
                        v-if="!g.canSign"
                        class="text-caption text-muted q-mt-xs"
                    >{{$t('watch.msg_cannot_sign')}}</div>
                </div>
                <p class="text-caption text-muted">{{$t('voterRewards.msg_how')}}</p>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import AddressLabel from 'components/AddressLabel.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { claimClauses, LOOKBACK, unclaimedRewards, type VoterReward } from 'src/utils/voter-rewards'
import { B3TR } from 'src/utils/ecosystem'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatUnits } from 'src/utils/format'
import { money, prefs } from 'src/utils/prefs'
import { genesises } from 'src/consts'

type Group = { address: string, canSign: boolean, total: bigint, rewards: VoterReward[] }

// B3TR earned by voting in VeBetterDAO's rounds, waiting to be claimed
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressLabel },
    data: () => ({
        LOOKBACK,
        loading: true,
        error: false,
        groups: [] as Group[],
        b3trFiat: 0
    }),
    computed: {
        total(): bigint {
            return this.groups.reduce((s, g) => s + g.total, 0n)
        }
    },
    async created() {
        await this.load()
    },
    methods: {
        formatUnits,
        money,
        units(wei: bigint) {
            return Number(wei / 10n ** 14n) / 1e4
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                const main = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const chosen = selection.walletId === ALL_WALLETS ? main : [selectedWallet(main)].filter((w): w is M.Wallet => !!w)
                const signable = new Set(chosen.filter(canSign).flatMap(w => w.meta.addresses.map(a => a.toLowerCase())))
                const addresses = chosen.flatMap(w => w.meta.addresses)
                const { rewards } = await unclaimedRewards(this.$svc.bc(genesises.main.id).thor, addresses)
                const by = new Map<string, Group>()
                for (const r of rewards) {
                    const g = by.get(r.address) || { address: r.address, canSign: signable.has(r.address), total: 0n, rewards: [] }
                    g.rewards.push(r)
                    g.total += r.amount
                    by.set(r.address, g)
                }
                this.groups = [...by.values()]
                void this.loadPrice()
            } catch (err) {
                console.warn('voter rewards:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        async loadPrice() {
            try {
                const [stats, fx] = await Promise.all([this.$svc.prices.stats([B3TR]), this.$svc.prices.fx(prefs.currency)])
                this.b3trFiat = (stats[B3TR]?.price || 0) * fx
            } catch { }
        },
        async claim(g: Group) {
            const comment = this.$t('voterRewards.comment', { n: g.rewards.length })
            try {
                await this.$signTx(genesises.main.id, {
                    message: claimClauses(g.rewards).map(c => ({ ...c, comment })),
                    options: { signer: g.address, comment }
                })
            } catch {
                return
            }
            this.$dialog({ component: SuccessDialog, title: this.$t('voterRewards.title_claimed'), message: this.$t('voterRewards.msg_claimed', { amount: formatUnits(g.total, 18, 2) }) }).catch(() => { })
            setTimeout(() => void this.load(), 12 * 1000)
        }
    }
})
</script>
<style lang="sass" scoped>
.total
  padding: 16px

.total-label
  font-size: 12px
  font-weight: 700

.total-value
  font-size: 26px
</style>
