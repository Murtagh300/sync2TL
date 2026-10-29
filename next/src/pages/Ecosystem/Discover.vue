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
                <q-list
                    role="list"
                    class="bvm-list"
                >
                    <app-row
                        v-for="a in others"
                        :key="a.id"
                        :app="a"
                    />
                </q-list>
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
import { earnedByApp, roundApps, type X2App } from 'src/utils/x2earn'
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
        earned: { type: Object as () => bigint, default: undefined }
    },
    setup(props) {
        const t = (k: string, p?: Record<string, unknown>) => i18n.global.t(k, p || {})
        return () => {
            const a = props.app
            const caption = props.earned !== undefined
                ? t('discover.label_earned_app', { amount: formatUnits(props.earned, 18) })
                : a.description
            return h(QItem, { clickable: !!a.url, onClick: () => a.url && openDapp(a.url) }, () => [
                h(QItemSection, { avatar: true }, () => h(QAvatar, { rounded: true, size: '40px', class: 'app-logo' }, () =>
                    a.logo ? h('img', { src: a.logo, alt: '', loading: 'lazy' }) : h(QIcon, { name: 'o_eco' }))),
                h(QItemSection, { style: 'min-width: 0' }, () => [
                    h(QItemLabel, { class: 'ellipsis' }, () => a.name),
                    caption ? h(QItemLabel, { caption: true, lines: 2 }, () => caption) : null
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
        b3trFiat: 0
    }),
    computed: {
        /** apps that paid this wallet, the most first */
        mine(): X2App[] {
            return this.apps.filter(a => this.earned[a.id]).sort((a, b) => (this.earned[b.id]! > this.earned[a.id]! ? 1 : -1))
        },
        others(): X2App[] {
            return this.apps.filter(a => !this.earned[a.id])
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

:deep(.app-logo)
  background: rgba(255, 255, 255, 0.05)
  img
    object-fit: cover
</style>
