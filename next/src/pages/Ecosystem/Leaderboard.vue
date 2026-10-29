<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('leaderboard.title')" />
        <page-content
            class="col"
            padding
        >
            <q-btn-toggle
                v-model="days"
                :options="[{ label: $t('leaderboard.label_week'), value: 7 }, { label: $t('leaderboard.label_month'), value: 30 }]"
                no-caps
                unelevated
                spread
                toggle-color="primary"
                color="dark"
                class="q-mb-md"
            />
            <empty-state
                v-if="noServer"
                icon="o_leaderboard"
                :text="$t('leaderboard.msg_no_server')"
            />
            <div
                v-else-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 6"
                    :key="i"
                    height="52px"
                />
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <template v-else-if="board">
                <!-- where this wallet stands -->
                <div class="bvm-tile you row no-wrap items-center q-mb-md">
                    <div class="you-rank bvm-display">{{best ? `#${best.rank}` : '–'}}</div>
                    <div class="col q-ml-md">
                        <div class="text-weight-bold">{{best ? $t('leaderboard.label_you', { total: board.total, pct: topPct }) : $t('leaderboard.label_not_ranked')}}</div>
                        <div
                            v-if="best"
                            class="text-caption text-muted"
                        >{{$t('leaderboard.label_row', { b3tr: formatB3tr(best.b3tr), n: best.actions })}}</div>
                        <div
                            v-else
                            class="text-caption text-muted"
                        >{{$t('leaderboard.msg_not_ranked')}}</div>
                    </div>
                </div>
                <div class="bvm-label q-pb-sm">{{$t('leaderboard.label_top')}}</div>
                <q-list
                    role="list"
                    class="bvm-list"
                >
                    <q-item
                        v-for="(r, i) in board.top"
                        :key="r.address"
                        :class="{ 'row-mine': mine.has(r.address) }"
                    >
                        <q-item-section
                            avatar
                            class="rank"
                        >{{i + 1}}</q-item-section>
                        <q-item-section>
                            <q-item-label class="ellipsis"><address-label :addr="r.address" /></q-item-label>
                            <q-item-label caption>{{$t('leaderboard.label_actions', { n: r.actions }, r.actions)}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <span class="bvm-amount">{{formatB3tr(r.b3tr)}} B3TR</span>
                        </q-item-section>
                    </q-item>
                </q-list>
                <p class="text-caption text-muted q-mt-md">{{$t('leaderboard.msg_how', { days })}}</p>
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
import { genesises } from 'src/consts'
import { serverUrl } from 'src/utils/endpoints'
import { numberLocale } from 'src/utils/format'

type Row = { address: string, b3tr: number, actions: number }
type Board = { days: number, total: number, top: Row[], you: (Row & { rank: number }) | null }

// who earned the most B3TR in X2Earn apps lately, and where this wallet stands (the BlackVault server keeps the totals)
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressLabel },
    data: () => ({
        days: 7,
        wallets: [] as M.Wallet[],
        board: null as Board | null,
        /** per own address that is ranked */
        ranks: [] as (Row & { rank: number })[],
        loading: true,
        error: false,
        noServer: serverUrl === null
    }),
    computed: {
        mine(): Set<string> {
            return new Set(this.wallets.filter(w => w.gid === genesises.main.id).flatMap(w => w.meta.addresses.map(a => a.toLowerCase())))
        },
        /** the best placed of the user's addresses */
        best(): (Row & { rank: number }) | null {
            return [...this.ranks].sort((a, b) => a.rank - b.rank)[0] || null
        },
        topPct(): string {
            if (!this.best || !this.board?.total) return ''
            const pct = Math.max(0.1, this.best.rank / this.board.total * 100)
            return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: pct < 10 ? 1 : 0 }).format(pct)
        }
    },
    watch: {
        days() { void this.load() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        await this.load()
    },
    methods: {
        formatB3tr(n: number): string {
            return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n)
        },
        async get(address = ''): Promise<Board> {
            const q = new URLSearchParams({ days: String(this.days) })
            if (address) q.set('address', address)
            const r = await fetch(`${serverUrl}/x2earn/leaderboard?${q}`)
            if (!r.ok) throw new Error(`leaderboard ${r.status}`)
            return await r.json() as Board
        },
        async load() {
            if (this.noServer) {
                this.loading = false
                return
            }
            this.loading = true
            this.error = false
            try {
                // the top list once, and each own address's place (up to 10)
                const own = [...this.mine].slice(0, 10)
                const [board, ...mine] = await Promise.all([this.get(), ...own.map(a => this.get(a))])
                this.board = board
                this.ranks = mine.map(b => b.you).filter((y): y is Row & { rank: number } => !!y)
            } catch (err) {
                console.warn('leaderboard:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.you
  padding: 12px 14px

.you-rank
  font-size: 26px
  min-width: 64px
  text-align: center

.rank
  min-width: 32px
  font-weight: 800
  color: var(--bv-text-muted, #9a9a9a)
  font-variant-numeric: tabular-nums

.row-mine
  background: var(--bv-accent-soft)
</style>
