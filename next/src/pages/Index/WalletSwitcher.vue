<template>
    <q-btn
        flat
        no-caps
        class="wallet-switcher"
        :aria-label="$t('home.action_switch')"
    >
        <q-avatar
            v-if="profile && profile.avatar"
            size="32px"
            rounded
        >
            <img :src="profile.avatar">
        </q-avatar>
        <address-avatar
            v-else-if="wallet"
            :addr="wallet.meta.addresses[0]"
            size="32px"
        />
        <div
            class="q-ml-sm text-left"
            style="min-width: 0"
        >
            <div class="switcher-name ellipsis">{{all ? $t('home.label_all_wallets') : wallet ? wallet.meta.name : 'BlackVault'}}</div>
            <div
                v-if="all"
                class="switcher-sub ellipsis text-muted"
            >{{$t('home.label_wallet_count', { n: wallets.length })}}</div>
            <div
                v-else-if="wallet"
                class="switcher-sub ellipsis text-muted"
            >
                <template v-if="profile && profile.displayName">@{{profile.displayName}}</template>
                <address-label
                    v-else
                    :addr="wallet.meta.addresses[0]"
                />
            </div>
        </div>
        <q-icon
            name="expand_more"
            size="20px"
            class="q-ml-xs text-muted"
        />
        <q-menu
            anchor="bottom left"
            self="top left"
            :offset="[0, 6]"
            class="switcher-menu"
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
                        <address-avatar
                            :addr="w.meta.addresses[0]"
                            size="30px"
                        />
                    </q-item-section>
                    <q-item-section style="min-width: 0">
                        <q-item-label lines="1">{{w.meta.name}}</q-item-label>
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
import AddressAvatar from 'components/AddressAvatar.vue'
import AddressLabel from 'components/AddressLabel.vue'
import type { BVM } from 'boot/services/bvm'

// the current wallet, and a menu to change it
export default defineComponent({
    components: { AddressAvatar, AddressLabel },
    props: {
        wallet: Object as () => M.Wallet | null,
        wallets: { type: Array as () => M.Wallet[], default: () => [] },
        all: Boolean
    },
    emits: ['select'],
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        profile: null as BVM.Profile | null
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
<style lang="sass" scoped>
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
