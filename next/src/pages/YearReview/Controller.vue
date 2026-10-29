<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('yearReview.title')">
            <q-btn
                v-if="stats && stats.transactions"
                flat
                round
                icon="o_share"
                :aria-label="$t('yearReview.action_share')"
                @click="share()"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <q-btn-toggle
                v-model="year"
                dense
                no-caps
                unelevated
                toggle-color="primary"
                color="dark"
                class="q-mb-md"
                :options="years.map(y => ({ label: String(y), value: y }))"
            />
            <div
                v-if="loading"
                class="row q-col-gutter-sm"
            >
                <div
                    v-for="i in 6"
                    :key="i"
                    class="col-6"
                >
                    <q-skeleton height="96px" />
                </div>
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <empty-state
                v-else-if="!stats || !stats.transactions"
                icon="o_celebration"
                :text="$t('yearReview.msg_none', { year })"
            />
            <template v-else>
                <div class="text-center q-mb-md">
                    <div class="bvm-display headline">{{$t('yearReview.headline', { year })}}</div>
                    <div class="text-muted">{{$t('yearReview.msg_sub', { days: stats.activeDays })}}</div>
                </div>
                <div class="row q-col-gutter-sm">
                    <div
                        v-for="t in tiles"
                        :key="t.label"
                        class="col-6"
                    >
                        <div class="bvm-tile tile">
                            <div class="bvm-amount tile-value">{{t.value}}</div>
                            <div class="text-muted tile-label">{{t.label}}</div>
                        </div>
                    </div>
                </div>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    icon="o_share"
                    class="full-width q-mt-lg"
                    :label="$t('yearReview.action_share')"
                    @click="share()"
                />
                <p class="text-caption text-muted q-mt-md">{{$t('yearReview.msg_private')}}</p>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { flows, yearRange, ZERO } from 'src/utils/overview'
import { rewardsOf } from 'src/utils/x2earn'
import { yearStats, type YearStats } from 'src/utils/year-review'
import { shareCard } from 'src/utils/share-card'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { numberLocale } from 'src/utils/format'
import { genesises } from 'src/consts'

const B3TR = '0x5ef79995fe8a89e0812330e4378eb2660cede699'

// a year on VeChain in a few numbers, as a card to share; nothing on it names anyone
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState },
    data: () => {
        const now = new Date().getFullYear()
        return {
            loading: true,
            error: false,
            year: now,
            years: [now, now - 1],
            stats: null as YearStats | null
        }
    },
    computed: {
        tiles(): { label: string, value: string }[] {
            const s = this.stats
            if (!s) return []
            const n = (v: number) => new Intl.NumberFormat(numberLocale(), { notation: v >= 100000 ? 'compact' : 'standard', maximumFractionDigits: v < 10 ? 1 : 0 }).format(v)
            const units = (wei: bigint) => Number(wei / 10n ** 14n) / 1e4
            const vet = s.totals[ZERO]
            const out = [
                { label: this.$t('yearReview.k_transactions'), value: n(s.transactions) },
                { label: this.$t('yearReview.k_people'), value: n(s.people) }
            ]
            if (s.busiestMonth !== null) {
                out.push({ label: this.$t('yearReview.k_busiest'), value: new Date(s.year, s.busiestMonth, 1).toLocaleDateString(this.$i18n.locale, { month: 'long' }) })
            }
            if (vet && vet.in > 0n) out.push({ label: this.$t('yearReview.k_vet_in'), value: n(units(vet.in)) })
            if (vet && vet.out > 0n) out.push({ label: this.$t('yearReview.k_vet_out'), value: n(units(vet.out)) })
            if (s.rewards.count) {
                out.push({ label: this.$t('yearReview.k_actions'), value: n(s.rewards.count) })
                out.push({ label: this.$t('yearReview.k_b3tr'), value: n(units(s.rewards.amount)) })
            }
            const b3tr = s.totals[B3TR]
            if (!s.rewards.count && b3tr && b3tr.in > 0n) out.push({ label: this.$t('yearReview.k_b3tr_in'), value: n(units(b3tr.in)) })
            return out.slice(0, 8)
        }
    },
    watch: {
        year() { void this.load() }
    },
    async created() {
        await this.load()
    },
    methods: {
        async load() {
            this.loading = true
            this.error = false
            try {
                const main = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const chosen = selection.walletId === ALL_WALLETS ? main : [selectedWallet(main)].filter((w): w is M.Wallet => !!w)
                const addresses = [...new Set(chosen.flatMap(w => w.meta.addresses))]
                const thor = this.$svc.bc(genesises.main.id).thor
                const [from, to] = yearRange(this.year)
                const [list, rewards] = await Promise.all([
                    flows(thor, addresses, from, to),
                    rewardsOf(thor, addresses, 4096).catch(() => [])
                ])
                this.stats = yearStats(this.year, list, addresses, rewards)
            } catch (err) {
                console.warn('year review:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        share() {
            if (!this.stats) return
            void shareCard({
                title: this.$t('yearReview.headline', { year: this.year }),
                subtitle: this.$t('yearReview.msg_sub', { days: this.stats.activeDays }),
                stats: this.tiles
            }, this.$t('yearReview.share_text', { year: this.year })).catch(() => { })
        }
    }
})
</script>
<style lang="sass" scoped>
.headline
  font-size: 26px

.tile
  padding: 14px 16px

.tile-label
  font-size: 12px
  font-weight: 700

.tile-value
  font-size: 22px
  text-transform: capitalize
</style>
