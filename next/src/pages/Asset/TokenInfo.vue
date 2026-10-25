<template>
    <div
        v-if="info"
        class="bvm-tile q-mx-md q-mt-md q-pa-md"
    >
        <div class="bvm-label q-mb-sm">{{$t('tokenInfo.title')}}</div>
        <div class="facts">
            <div v-if="marketCap !== null">
                <div class="text-muted fact-label">{{$t('tokenInfo.label_market_cap')}}</div>
                <div class="bvm-amount">{{big(marketCap)}}</div>
            </div>
            <div>
                <div class="text-muted fact-label">{{$t('tokenInfo.label_volume')}}</div>
                <div class="bvm-amount">{{big(info.volume24h * fx)}}</div>
            </div>
            <div>
                <div class="text-muted fact-label">{{$t('tokenInfo.label_liquidity')}}</div>
                <div class="bvm-amount">{{big(info.liquidity * fx)}}</div>
            </div>
            <div v-if="info.circulatingSupply">
                <div class="text-muted fact-label">{{$t('tokenInfo.label_supply')}}</div>
                <div class="bvm-amount">{{compact(info.circulatingSupply)}}<span
                    v-if="info.maxSupply"
                    class="text-muted text-weight-regular"
                > / {{compact(info.maxSupply)}}</span></div>
            </div>
        </div>
        <p
            v-if="info.description"
            class="text-soft description q-mt-md q-mb-none"
        >{{info.description}}</p>
        <div
            v-if="info.links.length"
            class="row q-gutter-sm q-mt-sm"
        >
            <q-btn
                v-for="l in info.links"
                :key="l.kind"
                outline
                dense
                no-caps
                size="sm"
                class="q-px-sm"
                :icon="icons[l.kind]"
                :label="$t(`tokenInfo.link_${l.kind}`)"
                @click="openURL(l.url)"
            />
        </div>
        <div class="text-caption text-muted q-mt-sm">{{$t('tokenInfo.msg_source')}}</div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { money, prefs } from 'src/utils/prefs'
import { openURL } from 'src/utils/open-url'
import type { Prices } from 'boot/services/prices'

// market cap, volume, liquidity, supply and links of a token (BetterSwap)
export default defineComponent({
    props: {
        token: { type: Object as () => M.TokenSpec, required: true }
    },
    data: () => ({
        info: null as Prices.TokenInfo | null,
        price: null as number | null,
        fx: 1,
        icons: { website: 'o_language', twitter: 'o_alternate_email', telegram: 'o_send', discord: 'o_forum' } as Record<string, string>
    }),
    computed: {
        marketCap(): number | null {
            return this.info && this.price !== null && this.info.circulatingSupply ? this.info.circulatingSupply * this.price * this.fx : null
        }
    },
    async created() {
        try {
            const [info, stats, fx] = await Promise.all([
                this.$svc.prices.tokenInfo(this.token.address),
                this.$svc.prices.stats([this.token.address]),
                this.$svc.prices.fx(prefs.currency)
            ])
            const s = Object.values(stats)[0]
            this.price = s ? s.price : null
            this.fx = fx
            this.info = info
        } catch {
            // BetterSwap unreachable: no card
        }
    },
    methods: {
        openURL,
        big(v: number) {
            return money(v, prefs.currency, { compact: true })
        },
        compact(n: number) {
            return new Intl.NumberFormat(this.$i18n.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
        }
    }
})
</script>
<style lang="sass" scoped>
.facts
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 12px

.fact-label
  font-size: 12px
  font-weight: 700

.description
  font-size: 13px
  line-height: 1.45
  display: -webkit-box
  -webkit-line-clamp: 4
  -webkit-box-orient: vertical
  overflow: hidden
</style>
