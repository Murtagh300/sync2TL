<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('proposals.title')">
            <q-btn
                flat
                round
                icon="o_open_in_new"
                :aria-label="$t('a11y.open_external')"
                @click="openURL('https://governance.vebetterdao.org/proposals')"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('proposals.msg_intro')}}</p>
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
                    v-for="i in 3"
                    :key="i"
                    height="110px"
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
                v-else-if="!list.length"
                icon="o_gavel"
                :text="$t('proposals.msg_none')"
            />
            <div
                v-for="p in list"
                v-else
                :key="p.id"
                class="bvm-tile q-pa-md q-mb-md"
            >
                <div class="row no-wrap items-start">
                    <div class="col text-weight-bold title">{{p.title}}</div>
                    <q-badge
                        :color="p.state === 'active' ? 'primary' : 'grey-8'"
                        :text-color="p.state === 'active' ? 'dark' : 'white'"
                        rounded
                        class="q-ml-sm"
                    >{{$t(`proposals.state_${p.state}`)}}</q-badge>
                </div>
                <p
                    v-if="p.summary"
                    class="text-soft q-mt-xs q-mb-sm summary"
                >{{p.summary}}</p>
                <!-- the votes so far -->
                <div
                    v-if="total(p)"
                    class="bar row no-wrap q-mt-sm"
                    role="img"
                    :aria-label="barLabel(p)"
                >
                    <div
                        class="bar-for"
                        :style="{ width: pct(p, 'for') }"
                    />
                    <div
                        class="bar-against"
                        :style="{ width: pct(p, 'against') }"
                    />
                    <div
                        class="bar-abstain"
                        :style="{ width: pct(p, 'abstain') }"
                    />
                </div>
                <div class="row q-gutter-x-md text-caption text-muted q-mt-xs">
                    <span><i class="dot bar-for" /> {{$t('proposals.for')}} {{compact(p.votes.for)}}</span>
                    <span><i class="dot bar-against" /> {{$t('proposals.against')}} {{compact(p.votes.against)}}</span>
                    <span><i class="dot bar-abstain" /> {{$t('proposals.abstain')}} {{compact(p.votes.abstain)}}</span>
                </div>
                <div
                    v-if="p.state === 'active'"
                    class="q-mt-sm"
                >
                    <div class="text-caption text-muted">{{endsText(p)}}</div>
                    <div
                        v-if="mine[p.id]?.voted"
                        class="text-primary text-weight-bold q-mt-xs"
                    >{{$t('proposals.msg_voted')}}</div>
                    <div
                        v-else-if="!canSignHere"
                        class="text-muted q-mt-xs"
                    >{{$t('watch.msg_cannot_sign')}}</div>
                    <div
                        v-else-if="!(mine[p.id]?.power)"
                        class="text-muted q-mt-xs"
                    >{{$t('proposals.msg_no_power')}}</div>
                    <div
                        v-else
                        class="row q-gutter-sm q-mt-xs"
                    >
                        <q-btn
                            v-for="s in (['for', 'against', 'abstain'] as const)"
                            :key="s"
                            :unelevated="s === 'for'"
                            :outline="s !== 'for'"
                            no-caps
                            dense
                            color="primary"
                            class="q-px-md"
                            :loading="working === p.id + s"
                            :disable="!!working"
                            :label="$t(`proposals.action_${s}`)"
                            @click="cast(p, s)"
                        />
                    </div>
                    <div
                        v-if="problem[p.id]"
                        class="text-warning q-mt-xs"
                    >{{problem[p.id]}}</div>
                </div>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { openURL } from 'quasar'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatDate, numberLocale } from 'src/utils/format'
import { blockTime } from 'src/utils/ecosystem'
import { voteProblem } from 'src/utils/vote'
import { latestProposals, myStanding, proposalVoteClause, type Proposal, type Support } from 'src/utils/governance'

// VeBetterDAO's proposals, and voting on them with VOT3
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState },
    data: () => ({
        wallets: [] as M.Wallet[],
        address: '',
        list: [] as Proposal[],
        mine: {} as Record<string, { voted: boolean, power: bigint }>,
        problem: {} as Record<string, string>,
        loading: true,
        error: false,
        working: ''
    }),
    computed: {
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets.filter(w => w.gid === genesises.main.id))
        },
        addresses(): { label: string, value: string }[] {
            return (this.wallet?.meta.addresses || []).map((a, k) => ({ label: `#${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a }))
        },
        canSignHere(): boolean {
            return canSign(this.wallet)
        }
    },
    watch: {
        address() { void this.loadMine() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        this.address = this.wallet?.meta.addresses[0] || ''
        await this.load()
    },
    methods: {
        openURL,
        compact(v: number) {
            return new Intl.NumberFormat(numberLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(v)
        },
        total(p: Proposal) {
            return p.votes.for + p.votes.against + p.votes.abstain
        },
        pct(p: Proposal, k: 'for' | 'against' | 'abstain') {
            return `${(p.votes[k] / (this.total(p) || 1)) * 100}%`
        },
        barLabel(p: Proposal) {
            return `${this.$t('proposals.for')} ${this.compact(p.votes.for)}, ${this.$t('proposals.against')} ${this.compact(p.votes.against)}, ${this.$t('proposals.abstain')} ${this.compact(p.votes.abstain)}`
        },
        endsText(p: Proposal) {
            const head = this.$svc.bc(genesises.main.id).thor.status.head
            return this.$t('proposals.label_ends', { when: formatDate(blockTime(p.deadline, head.number, head.timestamp), { relative: true }) })
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                this.list = await latestProposals(this.$svc.bc(genesises.main.id).thor)
                await this.loadMine()
            } catch (err) {
                console.warn('proposals:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        async loadMine() {
            const active = this.list.filter(p => p.state === 'active')
            if (!this.address || !active.length) return
            this.mine = await myStanding(this.$svc.bc(genesises.main.id).thor, this.address, active).catch(() => ({}))
        },
        async cast(p: Proposal, support: Support) {
            const thor = this.$svc.bc(genesises.main.id).thor
            const clause = proposalVoteClause(p.id, support)
            const comment = this.$t('proposals.comment', { choice: this.$t(`proposals.${support}`), title: p.title.slice(0, 60) })
            this.working = p.id + support
            this.problem = { ...this.problem, [p.id]: '' }
            try {
                // VePassport and the like: said before signing, not after
                const problem = await voteProblem(thor, this.address, clause).catch(() => '')
                if (problem) {
                    this.problem = { ...this.problem, [p.id]: problem === 'person' ? this.$t('vote.msg_person') : problem === 'voted' ? this.$t('proposals.msg_voted') : this.$t('vote.msg_refused', { reason: problem }) }
                    return
                }
                await this.$signTx(genesises.main.id, { message: [{ ...clause, comment }], options: { signer: this.address, comment } })
                this.mine = { ...this.mine, [p.id]: { voted: true, power: this.mine[p.id]?.power || 0n } }
                this.$q.notify(this.$t('proposals.msg_thanks'))
            } catch {
                // declined
            } finally {
                this.working = ''
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.title
  font-size: 16px
  line-height: 1.3

.summary
  font-size: 13px
  display: -webkit-box
  -webkit-line-clamp: 4
  -webkit-box-orient: vertical
  overflow: hidden

.bar
  height: 8px
  border-radius: 999px
  overflow: hidden
  background: rgba(255, 255, 255, 0.06)

.bar-for
  background: var(--q-primary)

.bar-against
  background: var(--q-negative)

.bar-abstain
  background: #8a8f98

.dot
  display: inline-block
  width: 8px
  height: 8px
  border-radius: 50%
  margin-right: 2px
</style>
