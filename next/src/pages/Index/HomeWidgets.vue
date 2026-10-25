<template>
    <!-- top tokens by value -->
    <section v-if="kind === 'tokens'">
        <div class="row items-center q-mt-xl q-mb-xs">
            <div class="bvm-label">{{$t('widgets.tokens')}}</div>
            <q-space />
            <q-btn
                flat
                dense
                no-caps
                size="sm"
                color="primary"
                :label="$t('widgets.action_all')"
                :to="{ name: 'portfolio' }"
            />
        </div>
        <q-list class="bvm-list">
            <q-item
                v-for="h in topTokens"
                :key="h.spec.symbol"
                clickable
                :to="{ name: 'asset', params: { walletId: String(wallet.id), addressIndex: '0', symbol: h.spec.symbol } }"
            >
                <q-item-section avatar>
                    <token-avatar
                        :spec="h.spec"
                        size="32px"
                    />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{h.spec.symbol}}</q-item-label>
                    <q-item-label
                        caption
                        :class="h.change24h >= 0 ? 'text-primary' : 'text-negative'"
                    >{{h.change24h >= 0 ? '+' : ''}}{{h.change24h.toFixed(1)}}%</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <div class="bvm-amount text-white">{{money(h.usd * fx)}}</div>
                </q-item-section>
            </q-item>
            <q-item v-if="!topTokens.length">
                <q-item-section>
                    <q-skeleton
                        type="text"
                        width="60%"
                    />
                </q-item-section>
            </q-item>
        </q-list>
    </section>

    <!-- what moves in the watchlist -->
    <section v-else-if="kind === 'watchlist'">
        <div class="row items-center q-mt-xl q-mb-xs">
            <div class="bvm-label">{{$t('widgets.watchlist')}}</div>
            <q-space />
            <q-btn
                flat
                dense
                no-caps
                size="sm"
                color="primary"
                :label="$t('widgets.action_all')"
                :to="{ name: 'watchlist' }"
            />
        </div>
        <q-list
            v-if="feed.length"
            class="bvm-list"
        >
            <q-item
                v-for="item in feed"
                :key="item.id"
                clickable
                :to="{ name: 'collection', params: { slug: item.collectionSlug } }"
            >
                <q-item-section avatar>
                    <q-avatar rounded>
                        <img
                            :src="item.image"
                            loading="lazy"
                        >
                    </q-avatar>
                </q-item-section>
                <q-item-section style="min-width: 0">
                    <q-item-label lines="1">{{item.name}}</q-item-label>
                    <q-item-label caption>{{$t(`watchlist.kind_${item.kind}`)}} · {{item.collection}}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <span class="bvm-amount text-white">{{item.price}}</span>
                </q-item-section>
            </q-item>
        </q-list>
        <div
            v-else
            class="bvm-tile q-pa-md text-soft"
        >{{$t('watchlist.msg_empty')}}</div>
    </section>

    <!-- what is minting -->
    <section v-else-if="kind === 'launchpad'">
        <div class="row items-center q-mt-xl q-mb-xs">
            <div class="bvm-label">{{$t('widgets.launchpad')}}</div>
            <q-space />
            <q-btn
                flat
                dense
                no-caps
                size="sm"
                color="primary"
                :label="$t('widgets.action_all')"
                :to="{ name: 'launchpad' }"
            />
        </div>
        <div class="launch-row row no-wrap">
            <router-link
                v-for="l in launches"
                :key="l.id"
                class="launch bvm-tile"
                :to="{ name: 'launch', params: { slug: l.slug } }"
            >
                <q-img
                    :src="l.coverImage"
                    :ratio="1"
                />
                <div class="launch-name ellipsis">{{l.name}}</div>
            </router-link>
        </div>
    </section>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import TokenAvatar from 'components/TokenAvatar.vue'
import { walletPortfolio, type Holding } from 'src/utils/portfolio'
import { emptyWatchlist, type Watchlist } from 'src/utils/alerts'
import { money, prefs } from 'src/utils/prefs'
import type { BVM } from 'boot/services/bvm'

// the optional blocks of the home screen: top tokens, watchlist feed, launchpad
export default defineComponent({
    components: { TokenAvatar },
    props: {
        kind: { type: String as () => 'tokens' | 'watchlist' | 'launchpad', required: true },
        wallet: { type: Object as () => M.Wallet, required: true },
        wallets: { type: Array as () => M.Wallet[], default: () => [] }
    },
    data: () => ({
        topTokens: [] as Holding[],
        feed: [] as BVM.FeedItem[],
        launches: [] as BVM.Launch[],
        fx: 1
    }),
    async created() {
        this.fx = await this.$svc.prices.fx(prefs.currency)
        if (this.kind === 'tokens') {
            const p = await walletPortfolio(this.$svc, this.wallets.length ? this.wallets : this.wallet).catch(() => null)
            this.topTokens = (p?.holdings || []).filter(h => h.usd > 0).slice(0, 5)
        } else if (this.kind === 'watchlist') {
            const list = await this.$svc.config.getJSON<Watchlist>('watchlist', emptyWatchlist())
            const parts = await Promise.all(list.collections.slice(0, 5).map(s => this.$svc.bvm.activity(s, 4).catch(() => [] as BVM.FeedItem[])))
            this.feed = parts.flat().sort((a, b) => b.time - a.time).slice(0, 4)
        } else {
            this.launches = await this.$svc.bvm.launches().catch(() => [])
        }
    },
    methods: { money }
})
</script>
<style lang="sass" scoped>
.launch-row
  gap: 10px
  overflow-x: auto
  scrollbar-width: none

.launch
  flex: none
  width: 132px
  overflow: hidden
  color: inherit
  text-decoration: none

.launch-name
  padding: 6px 8px
  font-size: 12px
  font-weight: 800
</style>
