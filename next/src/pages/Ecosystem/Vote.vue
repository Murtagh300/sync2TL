<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('vote.title', { n: state?.round || '' })" />
        <page-content
            class="col"
            padding
        >
            <q-select
                v-if="addresses.length > 1"
                v-model="address"
                :options="addresses"
                emit-value
                map-options
                outlined
                dense
                :label="$t('vote.label_address')"
                class="q-mb-md"
            />
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 5"
                    :key="i"
                    height="60px"
                />
            </div>
            <empty-state
                v-else-if="error || !state"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <template v-else>
                <!-- what this address can do in this round -->
                <div class="bvm-tile power row no-wrap items-center q-mb-md">
                    <q-icon
                        name="o_how_to_vote"
                        size="26px"
                        :color="canVote ? 'primary' : 'grey-6'"
                    />
                    <div class="col q-ml-md">
                        <div class="text-muted power-label">{{$t('vote.label_power')}}</div>
                        <div class="bvm-amount power-value">{{formatUnits(state.power, 18, 2)}} VOT3</div>
                    </div>
                </div>
                <div
                    v-if="notice"
                    class="bvm-tile q-pa-md q-mb-md text-soft notice"
                >
                    {{notice}}
                    <div
                        v-if="problem === 'person'"
                        class="q-mt-sm"
                    >
                        <q-btn
                            outline
                            dense
                            no-caps
                            color="primary"
                            class="q-px-sm"
                            :label="$t('vote.action_passport')"
                            @click="openURL('https://governance.vebetterdao.org')"
                        />
                    </div>
                </div>

                <div class="row items-center q-pb-sm">
                    <div class="bvm-label">{{$t('vote.label_apps', { n: apps.length })}}</div>
                    <q-space />
                    <q-btn
                        v-if="canVote && lastShares && !picked.length"
                        flat
                        dense
                        no-caps
                        color="primary"
                        icon="o_replay"
                        :label="$t('vote.action_like_last')"
                        @click="likeLast()"
                    />
                    <q-btn
                        v-if="picked.length > 1"
                        flat
                        dense
                        no-caps
                        color="primary"
                        :label="$t('vote.action_equal')"
                        @click="equal()"
                    />
                </div>
                <q-list
                    role="list"
                    class="bvm-list"
                >
                    <q-item
                        v-for="a in apps"
                        :key="a.id"
                        tag="label"
                        :clickable="canVote"
                    >
                        <q-item-section
                            avatar
                            top
                        >
                            <q-checkbox
                                :model-value="a.id in shares"
                                :disable="!canVote"
                                @update:model-value="toggle(a.id, $event)"
                            />
                        </q-item-section>
                        <q-item-section
                            avatar
                            top
                        >
                            <q-avatar
                                rounded
                                size="36px"
                                class="logo"
                            >
                                <img
                                    v-if="a.logo"
                                    :src="a.logo"
                                    alt=""
                                    loading="lazy"
                                >
                                <q-icon
                                    v-else
                                    name="o_eco"
                                />
                            </q-avatar>
                        </q-item-section>
                        <q-item-section>
                            <q-item-label class="text-weight-bold ellipsis">{{a.name}}</q-item-label>
                            <q-item-label caption>{{$t('vote.label_votes', { n: compact(a.votes) })}}</q-item-label>
                            <div
                                v-if="a.id in shares"
                                class="row items-center no-wrap q-mt-xs"
                                @click.prevent
                            >
                                <q-slider
                                    v-model="shares[a.id]"
                                    :min="1"
                                    :max="100"
                                    dense
                                    color="primary"
                                    class="col"
                                    :aria-label="a.name"
                                />
                                <span class="q-ml-sm share">{{weightText(a.id)}}</span>
                            </div>
                        </q-item-section>
                    </q-item>
                </q-list>
                <p class="text-caption text-muted q-mt-md">{{$t('vote.msg_how')}}</p>
            </template>
        </page-content>
        <page-action v-if="state && !loading">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_how_to_vote"
                :disable="!canVote || !picked.length || working"
                :loading="working"
                :label="picked.length ? $t('vote.action_vote', { n: picked.length }) : $t('vote.action_pick')"
                @click="vote()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { openURL } from 'quasar'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import EmptyState from 'components/EmptyState.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatUnits, numberLocale } from 'src/utils/format'
import { veBetterInfo } from 'src/utils/ecosystem'
import { roundApps, type X2App } from 'src/utils/x2earn'
import { roundState, splitWeights, voteClause, voteProblem, type RoundState } from 'src/utils/vote'

const LAST = 'bv-last-votes'

/** per address (lowercase): the apps and shares of its last vote */
function loadLastVotes(): Record<string, Record<string, number>> {
    try {
        return JSON.parse(localStorage.getItem(LAST) || '{}') as Record<string, Record<string, number>>
    } catch {
        return {}
    }
}

function saveLastVote(address: string, shares: Record<string, number>) {
    try {
        localStorage.setItem(LAST, JSON.stringify({ ...loadLastVotes(), [address.toLowerCase()]: shares }))
    } catch { }
}

// vote in VeBetterDAO's allocation round: pick apps, share the VOT3, sign once
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, EmptyState },
    data: () => ({
        wallets: [] as M.Wallet[],
        address: '',
        state: null as RoundState | null,
        voted: false,
        allApps: [] as X2App[],
        /** the picked apps and their share, 1 to 100 (relative) */
        shares: {} as Record<string, number>,
        /** from a dry run: 'person', 'voted' or a reason */
        problem: '',
        loading: true,
        error: false,
        working: false
    }),
    computed: {
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets.filter(w => w.gid === genesises.main.id))
        },
        addresses(): { label: string, value: string }[] {
            return (this.wallet?.meta.addresses || []).map((a, k) => ({ label: `#${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a }))
        },
        apps(): X2App[] {
            const ids = new Set(this.state?.appIds || [])
            return this.allApps.filter(a => ids.has(a.id))
        },
        picked(): string[] {
            return Object.keys(this.shares)
        },
        weights(): Record<string, bigint> {
            const ids = this.picked
            const parts = splitWeights(this.state?.power || 0n, ids.map(id => this.shares[id] || 0))
            return Object.fromEntries(ids.map((id, i) => [id, parts[i]!]))
        },
        /** the shares this address voted with last time, for the apps that are in this round too */
        lastShares(): Record<string, number> | null {
            const saved = loadLastVotes()[this.address.toLowerCase()]
            if (!saved) return null
            const ids = new Set(this.state?.appIds || [])
            const still = Object.entries(saved).filter(([id]) => ids.has(id))
            return still.length ? Object.fromEntries(still) : null
        },
        canVote(): boolean {
            const s = this.state
            return !!s && s.active && !this.voted && s.power >= s.threshold && s.power > 0n && canSign(this.wallet) && this.problem !== 'person'
        },
        notice(): string {
            const s = this.state
            if (!s) return ''
            if (this.voted || this.problem === 'voted') return this.$t('vote.msg_voted', { n: s.round })
            if (!s.active) return this.$t('vote.msg_closed')
            if (!canSign(this.wallet)) return this.$t('watch.msg_cannot_sign')
            if (s.power < s.threshold || s.power === 0n) return this.$t('vote.msg_no_power', { min: formatUnits(s.threshold, 18, 0) })
            if (this.problem === 'person') return this.$t('vote.msg_person')
            if (this.problem) return this.$t('vote.msg_refused', { reason: this.problem })
            return ''
        }
    },
    watch: {
        address() { void this.load() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        this.address = this.wallet?.meta.addresses[0] || ''
        if (!this.address) this.loading = false
    },
    methods: {
        formatUnits,
        openURL,
        compact(n: number): string {
            return new Intl.NumberFormat(numberLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n)
        },
        async load() {
            if (!this.address) return
            this.loading = true
            this.error = false
            this.problem = ''
            this.shares = {}
            const thor = this.$svc.bc(genesises.main.id).thor
            try {
                const [info, apps] = await Promise.all([veBetterInfo(thor, this.address), roundApps(thor)])
                this.voted = info.voted
                this.allApps = apps
                this.state = await roundState(thor, this.address, info.round)
            } catch (err) {
                console.warn('vote:', err)
                this.error = true
            } finally {
                this.loading = false
            }
            // VePassport: asked once up front, so nobody picks apps for nothing
            const s = this.state
            if (s && s.active && !this.voted && s.power >= s.threshold && s.power > 0n && s.appIds[0]) {
                this.problem = await voteProblem(thor, this.address, voteClause(s.round, [{ id: s.appIds[0], weight: s.power }])).catch(() => '')
            }
        },
        toggle(id: string, on: boolean) {
            const next = { ...this.shares }
            if (on) next[id] = 50
            else delete next[id]
            this.shares = next
        },
        likeLast() {
            if (this.lastShares) this.shares = { ...this.lastShares }
        },
        equal() {
            this.shares = Object.fromEntries(this.picked.map(id => [id, 50]))
        },
        weightText(id: string): string {
            return `${formatUnits(this.weights[id] || 0n, 18, 0)}`
        },
        async vote() {
            const s = this.state
            if (!s || !this.canVote || !this.picked.length) return
            const votes = this.picked.map(id => ({ id, weight: this.weights[id] || 0n }))
            const clause = voteClause(s.round, votes)
            const comment = this.$t('vote.comment', { n: s.round, apps: this.picked.length })
            this.working = true
            try {
                const problem = await voteProblem(this.$svc.bc(genesises.main.id).thor, this.address, clause).catch(() => '')
                if (problem) {
                    this.problem = problem
                    return
                }
                await this.$signTx(genesises.main.id, {
                    message: [{ ...clause, comment }],
                    options: { signer: this.address, comment }
                })
                this.voted = true
                saveLastVote(this.address, this.shares)
                this.shares = {}
                this.$dialog({ component: SuccessDialog, title: this.$t('vote.title_done'), message: this.$t('vote.msg_done') }).catch(() => { })
            } catch {
                // declined
            } finally {
                this.working = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.power
  padding: 12px 14px

.power-label
  font-size: 12px
  font-weight: 700

.power-value
  font-size: 20px

.logo
  background: rgba(255, 255, 255, 0.06)

.share
  min-width: 56px
  text-align: right
  font-variant-numeric: tabular-nums
  font-size: 13px
</style>
