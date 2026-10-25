<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('notifications.title')">
            <q-btn
                v-if="list.length"
                flat
                round
                icon="o_delete_sweep"
                :aria-label="$t('notifications.action_clear')"
                @click="clear()"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <!-- push: also when BlackVault is closed -->
            <div class="bvm-tile q-pa-md q-mb-md row no-wrap items-center">
                <q-icon
                    name="o_notifications_active"
                    size="24px"
                    color="primary"
                />
                <div class="col q-mx-md">
                    <div class="text-weight-bold">{{$t('notifications.label_push')}}</div>
                    <div class="text-muted push-hint">{{pushHint}}</div>
                </div>
                <q-toggle
                    :model-value="pushOn"
                    :disable="!canPush || busy"
                    color="primary"
                    @update:model-value="togglePush"
                />
            </div>

            <div
                v-if="!list.length"
                class="text-center text-soft q-pa-xl column items-center"
            >
                <q-icon
                    name="o_notifications_none"
                    size="40px"
                    class="text-muted"
                />
                <p class="q-mt-md">{{$t('notifications.msg_empty')}}</p>
            </div>
            <q-list
                v-else
                class="bvm-list"
            >
                <q-item
                    v-for="n in list"
                    :key="n.id"
                    clickable
                    :class="{ 'unread': !n.read }"
                    @click="open(n)"
                >
                    <q-item-section avatar>
                        <q-avatar :icon="icons[n.kind]" />
                    </q-item-section>
                    <q-item-section style="min-width: 0">
                        <q-item-label lines="1">{{n.title}}</q-item-label>
                        <q-item-label
                            v-if="n.body"
                            caption
                            lines="2"
                        >{{n.body}}</q-item-label>
                        <q-item-label caption>{{ago(n.time)}}</q-item-label>
                    </q-item-section>
                    <q-item-section
                        v-if="!n.read"
                        side
                    >
                        <span class="dot" />
                    </q-item-section>
                </q-item>
            </q-list>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import { clearNotifications, markAllRead, notifications, type AppNotification, type NotificationKind } from 'src/utils/notifications'
import { bvmSession, bvmSignIn, disablePush, enablePush, pushEnabled, pushSupported, signInMessage } from 'src/utils/push'
import { selectedWallet } from 'src/utils/selection'
import { formatDate } from 'src/utils/format'
import { genesises } from 'src/consts'

// what happened while you looked away: transfers, offers, alerts, finished transactions
export default defineComponent({
    components: { PageToolbar, PageContent },
    data: () => ({
        notifications,
        pushOn: false,
        busy: false,
        wallets: [] as M.Wallet[],
        icons: {
            in: 'o_south_west',
            out: 'o_north_east',
            offer: 'o_local_offer',
            alert: 'o_trending_down',
            'tx-done': 'o_check_circle',
            'tx-failed': 'o_error'
        } as Record<NotificationKind, string>
    }),
    computed: {
        list(): AppNotification[] {
            return notifications.list
        },
        canPush(): boolean {
            return pushSupported() && !!this.wallet
        },
        wallet(): M.Wallet | null {
            // push needs a signed sign-in: a wallet with keys
            return selectedWallet(this.wallets.filter(w => w.gid === genesises.main.id && w.meta.type !== 'watch'))
        },
        pushHint(): string {
            if (!pushSupported()) return this.$t('notifications.msg_push_install')
            if (!this.wallet) return this.$t('home.msg_mainnet_only')
            return this.$t('notifications.msg_push')
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        this.pushOn = await pushEnabled()
    },
    beforeUnmount() {
        // what was seen is read
        markAllRead()
    },
    methods: {
        ago(t: number) {
            return formatDate(t, { relative: true })
        },
        open(n: AppNotification) {
            n.read = true
            if (n.route) {
                void this.$router.push(n.route)
            }
        },
        clear() {
            clearNotifications()
        },
        async togglePush(on: boolean) {
            const wallet = this.wallet
            if (!wallet) return
            this.busy = true
            try {
                if (!on) {
                    await disablePush()
                    this.pushOn = false
                    return
                }
                const address = wallet.meta.addresses[0]!
                // BlackVeMarket sends to a signed-in wallet: sign in with a certificate, as on the site
                if (await bvmSession() !== address.toLowerCase()) {
                    const message = signInMessage()
                    const resp = await this.$signCert(genesises.main.id, {
                        message,
                        options: { signer: address },
                        domain: 'blackvemarket.com',
                        origin: 'https://blackvemarket.com'
                    })
                    await bvmSignIn({ ...message, ...resp.annex, signature: resp.signature })
                }
                await enablePush()
                this.pushOn = true
                this.$q.notify(this.$t('notifications.msg_push_on'))
            } catch (err) {
                if (err instanceof Error && err.message === 'blocked') {
                    this.$q.notify(this.$t('notifications.msg_push_blocked'))
                } else if (err) {
                    console.warn('push:', err)
                    this.$q.notify(this.$t('notifications.msg_push_failed'))
                }
            } finally {
                this.busy = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.push-hint
  font-size: 12px

.unread
  background: color-mix(in srgb, var(--q-primary) 6%, transparent)

.dot
  width: 8px
  height: 8px
  border-radius: 50%
  background: var(--q-primary)
</style>
