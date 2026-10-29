<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('appHub.title')" />
        <page-content
            class="col"
            padding
        >
            <q-input
                v-model="query"
                outlined
                dense
                clearable
                class="q-mb-sm"
                :placeholder="$t('appHub.placeholder_search')"
                :aria-label="$t('appHub.placeholder_search')"
            >
                <template #prepend>
                    <q-icon name="o_search" />
                </template>
            </q-input>
            <div class="chips row no-wrap q-mb-md">
                <q-chip
                    v-for="c in chips"
                    :key="c.key"
                    clickable
                    :outline="category !== c.key"
                    :color="category === c.key ? 'primary' : undefined"
                    :text-color="category === c.key ? 'dark' : undefined"
                    :icon="c.icon"
                    class="q-ml-none"
                    :label="`${c.label} · ${c.n}`"
                    @click="category = category === c.key ? '' : c.key"
                />
            </div>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 6"
                    :key="i"
                    height="68px"
                />
            </div>
            <empty-state
                v-else-if="error && !apps.length"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <template v-else>
                <template v-if="!category && !q && featured.length">
                    <div class="bvm-label q-pb-sm">{{$t('appHub.label_featured')}}</div>
                    <div class="featured-grid q-mb-lg">
                        <button
                            v-for="a in featured"
                            :key="a.id"
                            type="button"
                            class="featured-app bvm-tile"
                            @click="open(a)"
                        >
                            <img
                                v-if="!broken.includes(a.id)"
                                :src="a.icon"
                                alt=""
                                class="featured-icon"
                                loading="lazy"
                                @error="broken.push(a.id)"
                            >
                            <q-icon
                                v-else
                                name="o_apps"
                                size="40px"
                                class="featured-icon"
                            />
                            <span class="featured-name ellipsis">{{a.name}}</span>
                            <span class="featured-cat ellipsis">{{$t(`appHub.cat_${a.category}`)}}</span>
                        </button>
                    </div>
                </template>
                <div class="bvm-label q-pb-sm">{{category ? chips.find(c => c.key === category)?.label : $t('appHub.label_all')}}</div>
                <q-list
                    role="list"
                    class="bvm-list"
                >
                    <q-item
                        v-for="a in shown"
                        :key="a.id"
                        clickable
                        @click="open(a)"
                    >
                        <q-item-section avatar>
                            <q-avatar
                                rounded
                                size="44px"
                                class="app-logo"
                            >
                                <img
                                    v-if="a.icon && !broken.includes(a.id)"
                                    :src="a.icon"
                                    alt=""
                                    loading="lazy"
                                    @error="broken.push(a.id)"
                                >
                                <q-icon
                                    v-else
                                    name="o_apps"
                                />
                            </q-avatar>
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label class="row no-wrap items-center">
                                <span class="ellipsis text-weight-bold">{{a.name}}</span>
                                <q-badge
                                    v-if="a.featured"
                                    color="primary"
                                    text-color="dark"
                                    class="q-ml-xs"
                                    :label="$t('appHub.badge_featured')"
                                />
                                <q-badge
                                    v-else-if="a.isNew"
                                    outline
                                    color="primary"
                                    class="q-ml-xs"
                                    :label="$t('appHub.badge_new')"
                                />
                            </q-item-label>
                            <q-item-label
                                caption
                                lines="2"
                            >{{a.desc}}</q-item-label>
                            <q-item-label
                                caption
                                class="app-meta"
                            >{{$t(`appHub.cat_${a.category}`)}}<template v-if="a.dao"> · VeBetterDAO</template></q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-icon
                                name="o_open_in_new"
                                size="18px"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <p
                    v-if="!shown.length"
                    class="text-soft text-center q-mt-md"
                >{{$t('appHub.msg_no_match')}}</p>
                <p class="text-caption text-muted q-mt-md">{{$t('appHub.msg_source', { n: apps.length })}}</p>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { CATEGORIES, filterApps, loadHub, mergeApps, type Category, type HubApp } from 'src/utils/apphub'
import { roundApps } from 'src/utils/x2earn'
import { openDapp } from 'src/utils/open-url'
import { genesises } from 'src/consts'

const ICONS: Record<Category | 'featured' | 'dao', string> = {
    featured: 'o_star',
    dao: 'o_eco',
    defi: 'o_currency_exchange',
    sustainability: 'o_park',
    collectibles: 'o_collections',
    marketplaces: 'o_storefront',
    games: 'o_sports_esports',
    utilities: 'o_build'
}

// every VeChain dApp: VeChain's App Hub and VeBetterDAO's apps, by category, ours first
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState },
    props: {
        cat: { type: String, default: '' }
    },
    data() {
        return {
            loading: true,
            error: false,
            apps: [] as HubApp[],
            query: '' as string | null,
            category: this.cat as Category | 'featured' | 'dao' | '',
            broken: [] as string[]
        }
    },
    computed: {
        q(): string {
            return (this.query || '').trim()
        },
        featured(): HubApp[] {
            return this.apps.filter(a => a.featured)
        },
        shown(): HubApp[] {
            return filterApps(this.apps, this.q, this.category)
        },
        chips(): { key: Category | 'featured' | 'dao', label: string, icon: string, n: number }[] {
            const keys: (Category | 'featured' | 'dao')[] = ['featured', 'dao', ...CATEGORIES]
            return keys
                .map(k => ({ key: k, label: this.$t(`appHub.cat_${k}`), icon: ICONS[k], n: filterApps(this.apps, '', k).length }))
                .filter(c => c.n > 0)
        }
    },
    async created() {
        await this.load()
    },
    methods: {
        async load() {
            this.loading = true
            this.error = false
            try {
                const [hub, dao] = await Promise.all([
                    loadHub(),
                    roundApps(this.$svc.bc(genesises.main.id).thor).catch(() => [])
                ])
                this.apps = mergeApps(hub, dao.map(d => ({ id: d.id, name: d.name, description: d.description, logo: d.logo, url: d.url })))
            } catch (err) {
                console.warn('app hub:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        open(a: HubApp) {
            openDapp(a.url)
        }
    }
})
</script>
<style lang="sass" scoped>
.chips
  overflow-x: auto
  scrollbar-width: none

.featured-grid
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))
  gap: 8px

.featured-app
  display: flex
  flex-direction: column
  align-items: center
  gap: 6px
  padding: 16px 8px 12px
  color: inherit
  font: inherit
  cursor: pointer
  border: 1px solid rgba(255, 255, 255, 0.08)
  background-image: linear-gradient(160deg, var(--bv-accent-soft), transparent 60%)

.featured-icon
  width: 56px
  height: 56px
  border-radius: 14px
  object-fit: cover
  background: rgba(255, 255, 255, 0.05)

.featured-name
  max-width: 100%
  font-weight: 800
  font-size: 13px

.featured-cat
  max-width: 100%
  font-size: 11px
  color: $text-muted

.app-logo
  background: rgba(255, 255, 255, 0.05)
  img
    object-fit: cover

.app-meta
  text-transform: none
</style>
