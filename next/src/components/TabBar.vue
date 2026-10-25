<template>
    <nav
        class="tab-bar row no-wrap"
        :aria-label="$t('tabs.label')"
    >
        <button
            v-for="t in tabs"
            :key="t.name"
            type="button"
            class="tab col"
            :class="{ 'tab--active': t.name === active }"
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

export const TAB_ROUTES = ['index', 'nfts', 'swap', 'activities', 'more']

// the five places of the app; tabs replace each other, they don't stack
export default defineComponent({
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
            ]
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
</style>
