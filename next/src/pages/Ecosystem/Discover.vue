<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('discover.title')">
            <q-btn
                flat
                round
                icon="o_leaderboard"
                :aria-label="$t('leaderboard.action_open')"
                :to="{ name: 'leaderboard' }"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('discover.msg_intro')}}</p>
            <!-- what this wallet earned, all apps together -->
            <div
                v-if="earnedTotal > 0n"
                class="bvm-tile earned row no-wrap items-center q-mb-md"
            >
                <q-icon
                    name="o_eco"
                    color="primary"
                    size="26px"
                    class="q-mr-md"
                />
                <div class="col">
                    <div class="text-muted earned-label">{{$t('discover.label_earned')}}</div>
                    <div class="bvm-amount earned-value">{{formatUnits(earnedTotal, 18)}} B3TR</div>
                </div>
                <div
                    v-if="b3trFiat"
                    class="text-muted"
                >≈ {{money(units(earnedTotal) * b3trFiat)}}</div>
            </div>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 5"
                    :key="i"
                    height="72px"
                />
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <template v-else>
                <template v-if="mine.length">
                    <div class="bvm-label q-pb-sm">{{$t('discover.label_yours')}}</div>
                    <q-list
                        role="list"
                        class="bvm-list q-mb-lg"
                    >
                        <app-row
                            v-for="a in mine"
                            :key="a.id"
                            :app="a"
                            :earned="earned[a.id]"
                        />
                    </q-list>
                </template>
                <div class="bvm-label q-pb-sm">{{$t('discover.label_round')}}</div>
                <q-input
                    v-model="query"
                    outlined
                    dense
                    clearable
                    class="q-mb-sm"
                    :placeholder="$t('discover.placeholder_search')"
                    :aria-label="$t('discover.placeholder_search')"
                >
                    <template #prepend>
                        <q-icon name="o_search" />
                    </template>
                </q-input>
                <div class="filter-row row no-wrap q-mb-sm">
                    <q-chip
                        v-for="k in impactKinds"
                        :key="k"
                        clickable
                        :outline="impact !== k"
                        :color="impact === k ? 'primary' : undefined"
                        :text-color="impact === k ? 'dark' : undefined"
                        class="q-ml-none"
                        :icon="IMPACT_ICONS[k]"
                        :label="$t(`impact.k_${k}`)"
                        @click="impact = impact === k ? '' : k"
                    />
                </div>
                <q-btn-toggle
                    v-model="sort"
                    dense
                    no-caps
                    unelevated
                    toggle-color="primary"
                    color="dark"
                    class="q-mb-sm"
                    :options="[{ label: $t('discover.sort_votes'), value: 'votes' }, { label: $t('discover.sort_reward'), value: 'reward' }]"
                />
                <q-list
                    role="list"
                    class="bvm-list"
                >
                    <app-row
                        v-for="a in filtered"
                        :key="a.id"
                        :app="a"
                        :stat="stats[a.id]"
                    />
                </q-list>
                <p
                    v-if="!filtered.length"
                    class="text-soft text-center q-mt-md"
                >{{$t('discover.msg_no_match')}}</p>
                <p class="text-caption text-muted q-mt-md">{{$t('discover.msg_how')}}</p>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent, h } from 'vue'
import { QAvatar, QBtn, QIcon, QItem, QItemLabel, QItemSection } from 'quasar'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { appStats, earnedByApp, roundApps, type AppStat, type X2App } from 'src/utils/x2earn'
import type { ImpactKey } from 'src/utils/impact'

const IMPACT_ICONS: Partial<Record<ImpactKey, string>> = {
    carbon: 'o_co2',
    water: 'o_water_drop',
    plastic: 'o_recycling',
    energy: 'o_bolt',
    waste_mass: 'o_delete_outline',
    trees_planted: 'o_park',
    calories_burned: 'o_directions_run',
    education_time: 'o_school'
}
import { B3TR } from 'src/utils/ecosystem'
import { selectedWallet } from 'src/utils/selection'
import { formatUnits } from 'src/utils/format'
import { openDapp } from 'src/utils/open-url'
import { money, prefs } from 'src/utils/prefs'
import { genesises } from 'src/consts'
import { i18n } from 'src/boot/i18n'

// one app: logo, name, a line of what it does, what it paid you, and a way in
const AppRow = defineComponent({
    props: {
        app: { type: Object as () => X2App, required: true },
        earned: { type: Object as () => bigint, default: undefined },
        stat: { type: Object as () => AppStat, default: undefined }
    },
    setup(props) {
        const t = (k: string, p?: Record<string, unknown>) => i18n.global.t(k, p || {})
        return () => {
            const a = props.app
            const caption = props.earned !== undefined
                ? t('discover.label_earned_app', { amount: formatUnits(props.earned, 18) })
                : a.description
            const perAction = props.stat && props.stat.perAction >= 0.01 ? t('discover.label_per_action', { amount: props.stat.perAction.toLocaleString(undefined, { maximumFractionDigits: 2 }) }) : ''
            return h(QItem, { clickable: !!a.url, onClick: () => a.url && openDapp(a.url) }, () => [
                h(QItemSection, { avatar: true }, () => h(QAvatar, { rounded: true, size: '40px', class: 'app-logo' }, () =>
                    a.logo ? h('img', { src: a.logo, alt: '', loading: 'lazy' }) : h(QIcon, { name: 'o_eco' }))),
                h(QItemSection, { style: 'min-width: 0' }, () => [
                    h(QItemLabel, { class: 'ellipsis' }, () => a.name),
                    caption ? h(QItemLabel, { caption: true, lines: 2 }, () => caption) : null,
                    perAction ? h(QItemLabel, { caption: true, class: 'text-primary' }, () => perAction) : null
                ]),
                a.url ? h(QItemSection, { side: true }, () => h(QBtn, { flat: true, round: true, dense: true, icon: 'o_open_in_new', 'aria-label': t('a11y.open_external'), onClick: (e: Event) => { e.stopPropagation(); openDapp(a.url) } })) : null
            ])
        }
    }
})

export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AppRow },
    data: () => ({
        loading: true,
        error: false,
        apps: [] as X2App[],
        earned: {} as Record<string, bigint>,
        b3trFiat: 0,
        stats: {} as Record<string, AppStat>,
        query: '' as string | null,
        impact: '' as ImpactKey | '',
        sort: 'votes' as 'votes' | 'reward',
        IMPACT_ICONS
    }),
    computed: {
        /** apps that paid this wallet, the most first */
        mine(): X2App[] {
            return this.apps.filter(a => this.earned[a.id]).sort((a, b) => (this.earned[b.id]! > this.earned[a.id]! ? 1 : -1))
        },
        others(): X2App[] {
            return this.apps.filter(a => !this.earned[a.id])
        },
        /** the kinds of impact some app states, in a fixed order */
        impactKinds(): ImpactKey[] {
            const seen = new Set(Object.values(this.stats).flatMap(s => s.impact))
            return (Object.keys(IMPACT_ICONS) as ImpactKey[]).filter(k => seen.has(k))
        },
        filtered(): X2App[] {
            const q = (this.query || '').trim().toLowerCase()
            const list = this.others.filter(a =>
                (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) &&
                (!this.impact || this.stats[a.id]?.impact.includes(this.impact)))
            return this.sort === 'reward'
                ? [...list].sort((a, b) => (this.stats[b.id]?.perAction || 0) - (this.stats[a.id]?.perAction || 0))
                : list
        },
        earnedTotal(): bigint {
            return Object.values(this.earned).reduce((s, v) => s + v, 0n)
        }
    },
    async created() {
        await this.load()
    },
    methods: {
        money,
        formatUnits,
        units(wei: bigint) {
            return Number(wei / 10n ** 14n) / 1e4
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                const thor = this.$svc.bc(genesises.main.id).thor
                const wallets = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const wallet = selectedWallet(wallets)
                const [apps, earned] = await Promise.all([
                    roundApps(thor),
                    earnedByApp(thor, wallet?.meta.addresses || []).catch(() => ({}))
                ])
                this.apps = apps
                this.earned = earned
                void this.loadPrice()
                appStats(thor).then(s => { this.stats = s }).catch(() => { })
            } catch (err) {
                console.warn('discover:', err)
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
        }
    }
})
</script>
<style lang="sass" scoped>
.earned
  padding: 14px 16px

.earned-label
  font-size: 12px
  font-weight: 700

.earned-value
  font-size: 22px

.filter-row
  overflow-x: auto
  scrollbar-width: none

:deep(.app-logo)
  background: rgba(255, 255, 255, 0.05)
  img
    object-fit: cover
</style>
