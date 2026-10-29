<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('impact.title')">
            <q-btn
                v-if="shown.length"
                flat
                round
                icon="o_share"
                :aria-label="$t('impact.action_share')"
                @click="share()"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('impact.msg_intro')}}</p>
            <div
                v-if="loading"
                class="row q-col-gutter-sm"
            >
                <div
                    v-for="i in 4"
                    :key="i"
                    class="col-6"
                >
                    <q-skeleton height="92px" />
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
                v-else-if="!shown.length"
                icon="o_eco"
                :text="$t('impact.msg_none')"
                :action="$t('discover.title')"
                @action="$router.push({ name: 'discover' })"
            />
            <template v-else>
                <div class="text-center q-mb-md">
                    <div class="bvm-display headline">{{headline}}</div>
                    <div class="text-muted">{{$t('impact.label_actions', { n: actions })}}<span v-if="since"> · {{$t('impact.label_since', { date: since })}}</span></div>
                </div>
                <div class="row q-col-gutter-sm">
                    <div
                        v-for="s in shown"
                        :key="s.key"
                        class="col-6"
                    >
                        <div class="bvm-tile tile">
                            <q-icon
                                :name="icons[s.key]"
                                size="22px"
                                color="primary"
                            />
                            <div class="bvm-amount tile-value q-mt-xs">{{s.text}}</div>
                            <div class="text-muted tile-label">{{$t(`impact.k_${s.key}`)}}</div>
                        </div>
                    </div>
                </div>
                <p class="text-caption text-muted q-mt-md">{{$t('impact.msg_source')}}</p>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { genesises } from 'src/consts'
import { numberLocale } from 'src/utils/format'
import { selectedWallet, selection, ALL_WALLETS } from 'src/utils/selection'
import { rewardsOf } from 'src/utils/x2earn'
import { addImpact, IMPACT_KEYS, impactShown, type Impact, type ImpactKey } from 'src/utils/impact'
import { shareCard } from 'src/utils/share-card'

const ICONS: Record<ImpactKey, string> = {
    carbon: 'o_co2',
    water: 'o_water_drop',
    plastic: 'o_recycling',
    energy: 'o_bolt',
    waste_mass: 'o_delete_outline',
    timber: 'o_forest',
    trees_planted: 'o_park',
    clean_energy_production_wh: 'o_solar_power',
    calories_burned: 'o_directions_run',
    education_time: 'o_school'
}

// what your X2Earn actions did for the planet, from the proofs on chain
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState },
    data: () => ({
        loading: true,
        error: false,
        total: {} as Impact,
        actions: 0,
        first: 0,
        icons: ICONS
    }),
    computed: {
        shown(): { key: ImpactKey, text: string }[] {
            return IMPACT_KEYS.filter(k => (this.total[k] || 0) > 0).map(k => ({ key: k, text: this.fmt(k, this.total[k]!) }))
        },
        headline(): string {
            const c = this.total.carbon
            return c ? this.$t('impact.headline_carbon', { amount: this.fmt('carbon', c) }) : this.$t('impact.headline_actions', { n: this.actions })
        },
        since(): string {
            return this.first ? new Date(this.first).toLocaleDateString(this.$i18n.locale, { month: 'long', year: 'numeric' }) : ''
        }
    },
    async created() {
        await this.load()
    },
    methods: {
        fmt(key: ImpactKey, v: number): string {
            const s = impactShown(key, v)
            const n = new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: s.value < 10 ? 1 : 0 }).format(s.value)
            return s.unit ? `${n} ${s.unit}` : n
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                const wallets = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const chosen = selection.walletId === ALL_WALLETS ? wallets : [selectedWallet(wallets)].filter((w): w is M.Wallet => !!w)
                const list = await rewardsOf(this.$svc.bc(genesises.main.id).thor, chosen.flatMap(w => w.meta.addresses))
                const { total, actions } = addImpact(list.map(r => r.proof))
                this.total = total
                this.actions = actions
                this.first = list.length ? Math.min(...list.map(r => r.time)) : 0
            } catch (err) {
                console.warn('impact:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        share() {
            const lines = this.shown.slice(0, 4).map(s => `${s.text} ${this.$t(`impact.k_${s.key}`)}`)
            void shareCard({ title: this.headline, subtitle: lines.join(' · ') }, this.$t('impact.share_text')).catch(() => { })
        }
    }
})
</script>
<style lang="sass" scoped>
.headline
  font-size: 26px

.tile
  padding: 12px 14px

.tile-label
  font-size: 12px
  font-weight: 700

.tile-value
  font-size: 20px
</style>
