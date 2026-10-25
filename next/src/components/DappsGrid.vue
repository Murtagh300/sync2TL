<template>
    <div class="dapps">
        <button
            v-for="d in sorted"
            :key="d.url"
            type="button"
            class="dapp bvm-tile"
            @click="open(d)"
        >
            <q-btn
                flat
                round
                dense
                size="sm"
                class="dapp-star"
                :icon="favs.includes(d.url) ? 'star' : 'star_outline'"
                :color="favs.includes(d.url) ? 'primary' : undefined"
                :aria-label="$t('dappsGrid.action_favorite')"
                @click.stop="toggle(d.url)"
            />
            <img
                v-if="d.icon && !broken.includes(d.url)"
                :src="d.icon"
                alt=""
                class="dapp-icon"
                loading="lazy"
                @error="broken.push(d.url)"
            >
            <div
                v-else
                class="dapp-icon flex flex-center"
            >
                <q-icon
                    name="o_language"
                    size="24px"
                />
            </div>
            <span class="dapp-name ellipsis">{{d.name}}</span>
            <span class="dapp-what ellipsis">{{$t(`dappsGrid.${d.what}`)}}</span>
        </button>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { openURL } from 'src/utils/open-url'
import bvmIcon from 'assets/bvm-icon.png'

type Dapp = { name: string, url: string, icon: string, what: 'market' | 'swap' | 'earn' | 'names' | 'explorer' }

const FAV_KEY = 'bv-fav-dapps'

// VeChain apps one tap away; starred ones come first
export default defineComponent({
    data: () => ({
        dapps: [
            { name: 'BlackVeMarket', url: 'https://blackvemarket.com', icon: bvmIcon, what: 'market' },
            { name: 'VeTrade', url: 'https://vetrade.vet', icon: 'https://vetrade.vet/favicon.ico', what: 'swap' },
            { name: 'BetterSwap', url: 'https://www.betterswap.io', icon: 'https://www.betterswap.io/favicon.ico', what: 'swap' },
            { name: 'VeBetterDAO', url: 'https://governance.vebetterdao.org', icon: 'https://governance.vebetterdao.org/favicon.ico', what: 'earn' },
            { name: 'vet.domains', url: 'https://vet.domains', icon: '', what: 'names' },
            { name: 'VeChainStats', url: 'https://vechainstats.com', icon: 'https://vechainstats.com/apple-touch-icon.png', what: 'explorer' }
        ] as Dapp[],
        favs: [] as string[],
        broken: [] as string[]
    }),
    computed: {
        sorted(): Dapp[] {
            return [...this.dapps].sort((a, b) => Number(this.favs.includes(b.url)) - Number(this.favs.includes(a.url)))
        }
    },
    created() {
        try {
            this.favs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[]
        } catch { }
    },
    methods: {
        open(d: Dapp) {
            openURL(d.url)
        },
        toggle(url: string) {
            this.favs = this.favs.includes(url) ? this.favs.filter(u => u !== url) : [...this.favs, url]
            try {
                localStorage.setItem(FAV_KEY, JSON.stringify(this.favs))
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.dapps
  display: grid
  grid-template-columns: repeat(3, 1fr)
  gap: 8px

.dapp
  position: relative
  display: flex
  flex-direction: column
  align-items: center
  gap: 4px
  padding: 14px 6px 10px
  color: inherit
  font: inherit
  cursor: pointer

.dapp-star
  position: absolute
  top: 2px
  right: 2px

.dapp-icon
  width: 40px
  height: 40px
  border-radius: 10px
  object-fit: contain
  background: rgba(255, 255, 255, 0.04)

.dapp-name
  max-width: 100%
  font-size: 13px
  font-weight: 800

.dapp-what
  max-width: 100%
  font-size: 11px
  color: $text-muted
</style>
