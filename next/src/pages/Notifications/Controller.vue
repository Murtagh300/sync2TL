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
                    :aria-label="$t('notifications.label_push')"
                    :disable="!canPush || busy"
                    color="primary"
                    @update:model-value="togglePush"
                />
            </div>

            <!-- incoming transfers through the BlackVault server: no sign-in, it only knows the addresses -->
            <div
                v-if="ownAvailable"
                class="bvm-tile q-pa-md q-mb-md row no-wrap items-center"
            >
                <q-icon
                    name="o_south_west"
                    size="24px"
                    color="primary"
                />
                <div class="col q-mx-md">
                    <div class="text-weight-bold">{{$t('service.label_push_incoming')}}</div>
                    <div class="text-muted push-hint">{{ownState === 'other' ? $t('service.msg_push_other') : $t('service.msg_push_incoming', { n: watchAddresses.length })}}</div>
                </div>
                <q-toggle
                    :model-value="ownState === 'on'"
                    :disable="busy || ownState === 'other' || !watchAddresses.length"
                    color="primary"
                    :aria-label="$t('service.label_push_incoming')"
                    @update:model-value="toggleOwnPush"
                />
            </div>
            <!-- what leaves your addresses: a key used somewhere else shows up at once -->
            <template v-if="ownAvailable && ownState === 'on'">
                <div
                    v-for="o in pushOpts"
                    :key="o.key"
                    class="bvm-tile q-pa-md q-mb-md row no-wrap items-center"
                >
                    <q-icon
                        :name="o.icon"
                        size="24px"
                        color="primary"
                    />
                    <div class="col q-mx-md">
                        <div class="text-weight-bold">{{$t(`service.label_push_${o.key}`)}}</div>
                        <div class="text-muted push-hint">{{$t(`service.msg_push_${o.key}`)}}</div>
                    </div>
                    <q-toggle
                        :model-value="prefs[o.pref]"
                        :disable="busy"
                        color="primary"
                        :aria-label="$t(`service.label_push_${o.key}`)"
                        @update:model-value="togglePushOption(o.pref, $event)"
                    />
                </div>
            </template>

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
                role="group"
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
import { bvmSession, bvmSignIn, disablePush, enablePush, pushEnabled, pushSupported, signInMessage, ownPushAvailable, ownPushState, enableOwnPush, disableOwnPush, pushOptions, pushValidators, setPushValidators, type OwnPushState } from 'src/utils/push'
import { stakePositions } from 'src/utils/ecosystem'
import { delegationsOf } from 'src/utils/validators'

type PushPref = 'pushOutgoing' | 'pushRounds' | 'pushRewards' | 'pushValidators' | 'pushTokens'

const PUSH_OPTS: { key: string, pref: PushPref, icon: string }[] = [
    { key: 'outgoing', pref: 'pushOutgoing', icon: 'o_shield' },
    { key: 'rounds', pref: 'pushRounds', icon: 'o_how_to_vote' },
    { key: 'rewards', pref: 'pushRewards', icon: 'o_redeem' },
    { key: 'validators', pref: 'pushValidators', icon: 'o_dns' },
    { key: 'tokens', pref: 'pushTokens', icon: 'o_fiber_new' }
]
import { syncBuyReminders } from 'src/utils/buy-reminders'
import { syncPriceAlerts } from 'src/utils/alerts'
import { featureOn } from 'src/utils/remote-config'
import { selectedWallet } from 'src/utils/selection'
import { formatDate } from 'src/utils/format'
import { genesises } from 'src/consts'
import { prefs } from 'src/utils/prefs'

// what happened while you looked away: transfers, offers, alerts, finished transactions
export default defineComponent({
    components: { PageToolbar, PageContent },
    data: () => ({
        notifications,
        prefs,
        pushOpts: PUSH_OPTS,
        pushOn: false,
        ownAvailable: false,
        ownState: 'off' as OwnPushState,
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
        /** the mainnet addresses to watch for incoming transfers, also watch-only ones (at most 20) */
        watchAddresses(): string[] {
            const all = this.wallets.filter(w => w.gid === genesises.main.id).flatMap(w => w.meta.addresses)
            return [...new Set(all.map(a => a.toLowerCase()))].slice(0, 20)
        },
        pushHint(): string {
            if (this.ownState === 'on') return this.$t('service.msg_push_other')
            if (!pushSupported()) return this.$t('notifications.msg_push_install')
            if (!this.wallet) return this.$t('home.msg_mainnet_only')
            return this.$t('notifications.msg_push')
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        this.ownAvailable = featureOn('push') && await ownPushAvailable()
        this.ownState = this.ownAvailable ? await ownPushState() : 'off'
        // one push subscription per device: when it is BlackVault's own, BlackVeMarket's is off
        this.pushOn = this.ownState !== 'on' && await pushEnabled()
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
                if (on && this.ownState === 'on') return
                if (!on) {
                    await disablePush()
                    this.pushOn = false
                    this.ownState = 'off'
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
                this.ownState = 'other'
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
        },
        /** one of the extra pushes on or off: the server gets the whole set again */
        async togglePushOption(pref: PushPref, on: boolean) {
            this.busy = true
            try {
                if (pref === 'pushValidators' && on) {
                    setPushValidators(await this.myValidators())
                }
                await enableOwnPush(this.watchAddresses, this.$i18n.locale, { ...pushOptions(), ...this.optionFor(pref, on) })
                prefs[pref] = on
            } catch (err) {
                console.warn('push:', err)
                this.$q.notify(this.$t('notifications.msg_push_failed'))
            } finally {
                this.busy = false
            }
        },
        optionFor(pref: PushPref, on: boolean) {
            switch (pref) {
                case 'pushOutgoing': return { outgoing: on }
                case 'pushRounds': return { rounds: on }
                case 'pushRewards': return { rewards: on }
                case 'pushTokens': return { tokens: on }
                default: return { validators: on ? pushValidators() : [] }
            }
        },
        /** the validators the StarGate NFTs of the watched addresses are with */
        async myValidators(): Promise<string[]> {
            const thor = this.$svc.bc(genesises.main.id).thor
            const ids: string[] = []
            for (const a of this.watchAddresses) {
                ids.push(...(await stakePositions(thor, a).catch(() => [])).map(p => p.tokenId))
            }
            return (await delegationsOf(thor, ids.slice(0, 60)).catch(() => [])).filter(d => d.status === 1 || d.status === 2).map(d => d.validator)
        },
        async toggleOwnPush(on: boolean) {
            this.busy = true
            try {
                if (on) {
                    await enableOwnPush(this.watchAddresses, this.$i18n.locale)
                    // recurring buys come by push too from now on
                    void syncBuyReminders(this.$t.bind(this))
                    void syncPriceAlerts(this.$svc, (key, params) => this.$t(key, params ?? {})).catch(() => { })
                    this.ownState = 'on'
                    this.$q.notify(this.$t('notifications.msg_push_on'))
                } else {
                    await disableOwnPush()
                    this.ownState = 'off'
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : ''
                if (msg === 'blocked') {
                    this.$q.notify(this.$t('notifications.msg_push_blocked'))
                } else if (msg === 'other') {
                    this.ownState = 'other'
                    this.$q.notify(this.$t('service.msg_push_other'))
                } else {
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
