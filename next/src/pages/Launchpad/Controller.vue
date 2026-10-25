<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('launchpad.title')" />
        <page-content
            class="col"
            size="md"
        >
            <q-pull-to-refresh
                color="primary"
                bg-color="dark"
                @refresh="done => load().finally(done)"
            >
            <div class="q-pa-md">
                <div
                    v-if="loading"
                    class="row justify-center q-py-xl"
                >
                    <q-spinner-dots size="32px" />
                </div>
                <div
                    v-else-if="error"
                    class="bvm-tile q-pa-lg text-center"
                >
                    <p>{{$t('nft.msg_unreachable')}}</p>
                    <q-btn
                        outline
                        color="primary"
                        :label="$t('nft.action_retry')"
                        @click="load()"
                    />
                </div>
                <empty-state
                    v-else-if="!launches.length"
                    icon="o_rocket_launch"
                    :text="$t('launchpad.msg_none')"
                    :action="$t('nft.action_explore')"
                    action-icon="o_open_in_new"
                    @action="openMarket()"
                />
                <div
                    v-else
                    class="launch-grid"
                >
                    <router-link
                        v-for="l in launches"
                        :key="l.id"
                        class="launch bvm-tile"
                        :to="{ name: 'launch', params: { slug: l.slug } }"
                    >
                        <q-img
                            :src="l.coverImage"
                            :ratio="1"
                        >
                            <div
                                class="launch-state"
                                :class="`launch-state--${state(l)}`"
                            >{{$t(`launchpad.state_${state(l)}`)}}</div>
                        </q-img>
                        <div class="q-pa-sm">
                            <div class="launch-name ellipsis">{{l.name}}</div>
                            <div class="text-muted launch-meta">
                                {{l.publicMinted}} / {{l.publicSupply}}
                                <template v-if="l.minPriceWei"> · {{price(l.minPriceWei)}} {{l.minPriceSymbol}}</template>
                            </div>
                            <q-linear-progress
                                :value="l.publicSupply ? l.publicMinted / l.publicSupply : 0"
                                color="primary"
                                track-color="grey-9"
                                rounded
                                class="q-mt-xs"
                            />
                        </div>
                    </router-link>
                </div>
            </div>
            </q-pull-to-refresh>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { openURL } from 'src/utils/open-url'
import { marketURL } from 'boot/services/bvm'
import { formatUnits } from 'src/utils/format'
import type { BVM } from 'boot/services/bvm'

export function launchState(l: BVM.Launch): 'live' | 'upcoming' | 'soldout' {
    if (l.soldOut) return 'soldout'
    return (l.phases || []).some(p => p.state === 'live') ? 'live' : 'upcoming'
}

// what is minting on the BlackVeMarket launchpad
export default defineComponent({
    components: { EmptyState, PageToolbar, PageContent },
    data: () => ({
        loading: true,
        error: false,
        launches: [] as BVM.Launch[]
    }),
    created() {
        void this.load()
    },
    methods: {
        openMarket() {
            openURL(marketURL)
        },
        state: launchState,
        price(wei: string) {
            return formatUnits(wei, 18)
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                this.launches = await this.$svc.bvm.launches()
            } catch {
                this.error = true
            } finally {
                this.loading = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.launch-grid
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))
  gap: 10px

.launch
  display: block
  overflow: hidden
  color: inherit
  text-decoration: none

.launch-name
  font-weight: 800

.launch-meta
  font-size: 12px

.launch-state
  position: absolute
  top: 8px
  left: 8px
  padding: 2px 8px
  border-radius: 999px
  font-size: 11px
  font-weight: 800
  background: rgba(0, 0, 0, 0.6)

.launch-state--live
  background: var(--q-primary)
  color: $on-primary
</style>
