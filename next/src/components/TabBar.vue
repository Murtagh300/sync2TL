<template>
    <nav
        class="tab-bar no-wrap"
        :class="vertical ? 'tab-bar--side column' : 'row'"
        :aria-label="$t('tabs.label')"
    >
        <div
            v-if="vertical"
            class="side-brand row items-center no-wrap"
        >
            <img
                src="~assets/bvm-logo.png"
                alt="BVM"
                class="side-logo"
            >
            <span class="side-product">BlackVault</span>
        </div>
        <button
            v-for="t in tabs"
            :key="t.name"
            type="button"
            class="tab"
            :class="{ 'tab--active': t.name === active, col: !vertical }"
            :aria-current="t.name === active ? 'page' : undefined"
            @click="go(t.name)"
        >
            <q-icon
                :name="t.name === active ? t.iconActive : t.icon"
                size="24px"
            />
            <span class="tab-label">{{t.label}}</span>
        </button>
    </nav>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { haptic } from 'src/utils/prefs'
import { featureOn } from 'src/utils/remote-config'

export const TAB_ROUTES = ['index', 'nfts', 'swap', 'activities', 'more']

// the five places of the app; tabs replace each other, they don't stack
export default defineComponent({
    props: {
        /** a side bar for wide screens */
        vertical: Boolean
    },
    computed: {
        active(): string {
            return String(this.$route.name || '')
        },
        tabs(): { name: string, icon: string, iconActive: string, label: string }[] {
            return [
                { name: 'index', icon: 'o_home', iconActive: 'home', label: this.$t('tabs.home') },
                { name: 'nfts', icon: 'o_photo_library', iconActive: 'photo_library', label: this.$t('nft.label_nfts') },
                { name: 'swap', icon: 'o_swap_vert', iconActive: 'swap_vert', label: this.$t('swap.title') },
                { name: 'activities', icon: 'o_receipt_long', iconActive: 'receipt_long', label: this.$t('tabs.activity') },
                { name: 'more', icon: 'o_menu', iconActive: 'menu', label: this.$t('tabs.more') }
            ].filter(t => t.name !== 'swap' || featureOn('swap'))
        }
    },
    methods: {
        go(name: string) {
            if (name === this.active) {
                return
            }
            haptic()
            void this.$router.replace({ name })
        }
    }
})
</script>
<style lang="sass" scoped>
.tab-bar
  flex: none
  border-top: 1px solid $hairline
  background: rgba(8, 10, 9, 0.96)
  backdrop-filter: blur(10px)
  padding-bottom: env(safe-area-inset-bottom)

.tab
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: 2px
  min-height: 58px
  padding: 6px 0
  border: 0
  background: none
  color: $text-muted
  font: inherit
  cursor: pointer
  &:active
    opacity: 0.7

.tab--active
  color: var(--q-primary)

.tab-label
  font-size: 11px
  font-weight: 700

// the side bar of wide screens
.tab-bar--side
  width: 232px
  flex: none
  padding: 16px 12px
  gap: 4px
  border-top: 0
  border-right: 1px solid $hairline
  .tab
    flex-direction: row
    justify-content: flex-start
    gap: 14px
    min-height: 46px
    padding: 0 14px
    border-radius: $radius
    &:hover
      background: rgba(255, 255, 255, 0.04)
  .tab--active
    background: color-mix(in srgb, var(--q-primary) 10%, transparent)
  .tab-label
    font-size: 15px

.side-brand
  padding: 6px 14px 22px
  gap: 10px

.side-logo
  height: 22px

.side-product
  font-size: 18px
  font-weight: 900
</style>
