<template>
    <div
        class="fit column no-wrap drawer-panel"
        style="width: 300px !important;max-width:80vw"
    >
        <!-- drawer content header -->
        <div class="drawer-head row items-center no-wrap">
            <img
                src="~assets/bvm-logo.png"
                alt="BVM"
                class="drawer-logo"
            >
            <span class="drawer-product">BlackVault</span>
            <q-badge
                v-if="distTag"
                outline
                color="warning"
                class="text-capitalize q-ml-sm"
            >{{distTag}}</q-badge>
        </div>
        <!-- content slot -->
        <div class="col">
            <slot />
        </div>
        <!-- drawer content footer -->
        <q-list padding>
            <q-item :to="{name: 'swap'}">
                <q-item-section avatar>
                    <q-icon
                        size="sm"
                        name="o_swap_vert"
                    />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{$t('swap.title')}}</q-item-label>
                </q-item-section>
            </q-item>
            <q-item :to="{name: 'launchpad'}">
                <q-item-section avatar>
                    <q-icon
                        size="sm"
                        name="o_rocket_launch"
                    />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{$t('launchpad.title')}}</q-item-label>
                </q-item-section>
            </q-item>
            <q-item :to="{name: 'watchlist'}">
                <q-item-section avatar>
                    <q-icon
                        size="sm"
                        name="o_visibility"
                    />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{$t('watchlist.title')}}</q-item-label>
                </q-item-section>
            </q-item>
            <q-item :to="{name: 'settings'}">
                <q-item-section avatar>
                    <q-icon
                        size="sm"
                        name="o_settings"
                    />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{$t('index.action_settings')}}</q-item-label>
                </q-item-section>
            </q-item>
            <q-item :to="{name: 'activities'}">
                <q-item-section avatar>
                    <q-icon
                        size="sm"
                        name="o_history"
                    />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{$t('index.action_activities')}}</q-item-label>
                </q-item-section>
                <q-item-section
                    v-if="(ongoingActivitiesCount || 0) > 0"
                    side
                >
                    <q-badge
                        color="primary"
                        text-color="dark"
                        class="q-mr-sm"
                    >{{ongoingActivitiesCount}}</q-badge>
                </q-item-section>
            </q-item>
            <q-item
                dense
                v-if="version && build"
            >
                <q-item-section class="text-center">
                    <q-item-label
                        caption
                        class="ellipsis"
                    >v{{version}} ({{build}})<br><span class="text-capitalize">{{mode}}</span></q-item-label>
                </q-item-section>
            </q-item>
        </q-list>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
    computed: {
        distTag(): string { return import.meta.env.DIST_TAG || '' },
        version(): string { return import.meta.env.APP_VERSION || '' },
        build(): string { return import.meta.env.APP_BUILD || '' },
        mode(): string {
            switch (import.meta.env.QUASAR_MODE) {
                case 'spa':
                case 'pwa':
                    return 'web app'
                default: return import.meta.env.QUASAR_MODE || ''
            }
        }
    },
    data: () => ({
        // async computed (see src/shims-async-computed.d.ts)
        ongoingActivitiesCount: null as number | null
    }),
    asyncComputed: {
        ongoingActivitiesCount() {
            return this.$svc.activity.uncompleted().then(r => r.length)
        }
    }
})
</script>
<style lang="sass" scoped>
.drawer-panel
  background: $surface
  border-right: 1px solid $hairline

.drawer-head
  height: 64px
  padding: 0 20px
  border-bottom: 1px solid $hairline

.drawer-logo
  height: 24px

.drawer-product
  margin-left: 12px
  padding-left: 12px
  border-left: 1px solid $hairline-2
  font-weight: 800
  font-size: 15px
  letter-spacing: -0.01em
</style>
