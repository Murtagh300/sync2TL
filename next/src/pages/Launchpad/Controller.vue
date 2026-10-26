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
                <div
                    v-if="!loading && !error && calendar.length"
                    class="q-mb-lg"
                >
                    <div class="bvm-label q-mb-sm">{{$t('calendar.title')}}</div>
                    <q-list role="group" class="bvm-list">
                        <q-item
                            v-for="e in calendar"
                            :key="e.id"
                        >
                            <q-item-section avatar>
                                <div class="cal-day column items-center">
                                    <span class="cal-month">{{month(e.start)}}</span>
                                    <span class="cal-date">{{new Date(e.start).getDate()}}</span>
                                </div>
                            </q-item-section>
                            <q-item-section style="min-width: 0">
                                <q-item-label
                                    lines="1"
                                    class="text-weight-bold"
                                >{{e.name}}</q-item-label>
                                <q-item-label
                                    caption
                                    lines="1"
                                >{{e.phase}} · {{time(e.start)}}</q-item-label>
                            </q-item-section>
                            <q-item-section side>
                                <div class="row no-wrap">
                                    <q-btn
                                        flat
                                        round
                                        dense
                                        :icon="reminded.includes(e.id) ? 'notifications_active' : 'o_notifications'"
                                        :color="reminded.includes(e.id) ? 'primary' : undefined"
                                        :aria-label="$t('calendar.action_remind')"
                                        :aria-pressed="reminded.includes(e.id)"
                                        @click="remind(e)"
                                    />
                                    <q-btn
                                        flat
                                        round
                                        dense
                                        icon="o_event"
                                        :aria-label="$t('calendar.action_ics')"
                                        @click="addToCalendar(e)"
                                    />
                                </div>
                            </q-item-section>
                        </q-item>
                    </q-list>
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
import { icsFor, reminders, toggleReminder, upcomingPhases, type LaunchEvent } from 'src/utils/launch-calendar'
import { downloadText } from 'src/utils/export'
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
        reminded: reminders().map(r => r.id),
        loading: true,
        error: false,
        launches: [] as BVM.Launch[]
    }),
    created() {
        void this.load()
    },
    computed: {
        calendar(): LaunchEvent[] {
            return upcomingPhases(this.launches)
        }
    },
    methods: {
        month(t: number) {
            return new Date(t).toLocaleDateString(this.$i18n.locale, { month: 'short' })
        },
        time(t: number) {
            return new Date(t).toLocaleString(this.$i18n.locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
        },
        remind(e: LaunchEvent) {
            const on = toggleReminder(e)
            this.reminded = reminders().map(r => r.id)
            this.$q.notify(this.$t(on ? 'calendar.msg_reminder_on' : 'calendar.msg_reminder_off', { name: e.name }))
            if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                void Notification.requestPermission().catch(() => { })
            }
        },
        addToCalendar(e: LaunchEvent) {
            downloadText(`${e.slug}-${e.id.split(':')[1]}.ics`, icsFor(e, `${marketURL}/launchpad/${e.slug}`), 'text/calendar')
        },
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
.cal-day
  width: 40px
  padding: 2px 0
  border-radius: 10px
  border: 1px solid $hairline-2
  line-height: 1.1

.cal-month
  font-size: 10px
  font-weight: 800
  text-transform: uppercase
  color: var(--q-primary)

.cal-date
  font-size: 17px
  font-weight: 900

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
