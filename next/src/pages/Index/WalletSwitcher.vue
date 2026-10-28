<template>
    <q-btn
        flat
        no-caps
        class="wallet-switcher"
    >
        <q-avatar
            v-if="profile && profile.avatar"
            size="32px"
            rounded
        >
            <img
                :src="profile.avatar"
                alt=""
            >
        </q-avatar>
        <wallet-mark
            v-else-if="wallet"
            :wallet="wallet"
            size="32px"
        />
        <div
            class="q-ml-sm text-left"
            style="min-width: 0"
        >
            <span class="bv-sr-only">{{$t('home.action_switch')}}: </span>
            <div class="switcher-name row no-wrap items-center">
                <span class="ellipsis">{{all ? $t('home.label_all_wallets') : wallet ? wallet.meta.name : 'BlackVault'}}</span>
                <!-- a wallet that only watches says so where its name is -->
                <span
                    v-if="!all && wallet?.meta.type === 'watch'"
                    class="watch-badge q-ml-sm"
                ><q-icon
                    name="o_visibility"
                    size="12px"
                    class="q-mr-xs"
                />{{$t('watch.label')}}</span>
            </div>
            <div
                v-if="all"
                class="switcher-sub ellipsis text-muted"
            >{{$t('home.label_wallet_count', { n: wallets.length })}}</div>
            <div
                v-else-if="wallet"
                class="switcher-sub ellipsis text-muted"
            >
                <!-- the same name as on the address card: the .vet name, else the short address -->
                <address-label
                    no-icon
                    :addr="wallet.meta.addresses[0]"
                />
            </div>
        </div>
        <q-icon
            name="expand_more"
            size="20px"
            class="q-ml-xs text-muted switcher-chevron"
            :class="{ 'switcher-chevron--open': open }"
        />
        <!-- the page dims behind the open menu -->
        <teleport to="body">
            <transition name="switcher-dim">
                <div
                    v-if="open"
                    class="switcher-dim"
                />
            </transition>
        </teleport>
        <q-menu
            anchor="bottom left"
            self="top left"
            :offset="[0, 8]"
            class="switcher-menu"
            transition-show="jump-down"
            transition-hide="jump-up"
            @show="open = true"
            @hide="open = false"
        >
            <q-list style="min-width: 260px">
                <q-item
                    v-if="wallets.length > 1"
                    v-close-popup
                    clickable
                    :active="all"
                    @click="$emit('select', -1)"
                >
                    <q-item-section avatar>
                        <q-avatar icon="o_account_balance_wallet" />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>{{$t('home.label_all_wallets')}}</q-item-label>
                        <q-item-label caption>{{$t('home.label_wallet_count', { n: wallets.length })}}</q-item-label>
                    </q-item-section>
                </q-item>
                <q-item
                    v-for="w in wallets"
                    :key="w.id"
                    v-close-popup
                    clickable
                    :active="!all && wallet?.id === w.id"
                    @click="$emit('select', w.id)"
                >
                    <q-item-section avatar>
                        <wallet-mark
                            :wallet="w"
                            size="30px"
                        />
                    </q-item-section>
                    <q-item-section style="min-width: 0">
                        <q-item-label lines="1">{{w.meta.name}}<q-icon
                            v-if="w.meta.type === 'watch'"
                            name="o_visibility"
                            size="14px"
                            class="q-ml-xs text-muted"
                            :title="$t('watch.label')"
                        /></q-item-label>
                        <q-item-label
                            caption
                            lines="1"
                        >
                            {{$netDisplayName(w.gid)}} · {{$t('home.label_addresses', { n: w.meta.addresses.length })}}
                        </q-item-label>
                    </q-item-section>
                    <q-item-section
                        v-if="!all && wallet?.id === w.id"
                        side
                    >
                        <q-icon
                            name="check"
                            color="primary"
                        />
                    </q-item-section>
                </q-item>
                <q-separator />
                <q-item
                    v-close-popup
                    clickable
                    :to="{ name: 'new-wallet' }"
                >
                    <q-item-section avatar>
                        <q-icon name="add" />
                    </q-item-section>
                    <q-item-section>{{$t('newWallet.title')}}</q-item-section>
                </q-item>
            </q-list>
        </q-menu>
    </q-btn>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import WalletMark from 'components/WalletMark.vue'
import AddressLabel from 'components/AddressLabel.vue'
import type { BVM } from 'boot/services/bvm'

// the current wallet, and a menu to change it
export default defineComponent({
    components: { WalletMark, AddressLabel },
    props: {
        wallet: Object as () => M.Wallet | null,
        wallets: { type: Array as () => M.Wallet[], default: () => [] },
        all: Boolean
    },
    emits: ['select'],
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        profile: null as BVM.Profile | null,
        open: false
    }),
    asyncComputed: {
        async profile(): Promise<BVM.Profile | null> {
            const w = this.wallet
            if (!w || !this.$svc.bvm.supports(w.gid)) {
                return null
            }
            return this.$svc.bvm.profile(w.meta.addresses[0]!)
        }
    }
})
</script>
<style lang="sass">
// the dimmed page lives outside the component (teleported)
.switcher-dim
  position: fixed
  inset: 0
  z-index: 5999
  background: rgba(0, 0, 0, 0.45)
  pointer-events: none

.switcher-dim-enter-active, .switcher-dim-leave-active
  transition: opacity 0.18s

.switcher-dim-enter-from, .switcher-dim-leave-to
  opacity: 0
</style>
<style lang="sass" scoped>
.switcher-chevron
  transition: transform 0.18s

.switcher-chevron--open
  transform: rotate(180deg)

.watch-badge
  display: inline-flex
  align-items: center
  flex: none
  padding: 1px 7px
  border-radius: 999px
  border: 1px solid $hairline-2
  color: $text-muted
  font-size: 11px
  font-weight: 700

.wallet-switcher
  padding: 4px 8px
  max-width: 70vw
  border-radius: $radius

.switcher-name
  font-size: 16px
  font-weight: 800
  line-height: 1.2

.switcher-sub
  font-size: 12px
  line-height: 1.2
</style>
