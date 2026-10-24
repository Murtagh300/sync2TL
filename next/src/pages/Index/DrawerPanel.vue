<template>
    <div
        class="fit column no-wrap drawer-panel"
        style="width: 300px !important;max-width:80vw"
    >
        <!-- drawer content header -->
        <q-toolbar>
            <q-avatar square>
                <img src="~assets/bvm-icon.png">
            </q-avatar>
            <q-toolbar-title>
                BlackVault
                <q-badge
                    v-if="distTag"
                    outline
                    color="warning"
                    align="top"
                    class="text-capitalize"
                >{{distTag}} </q-badge>
            </q-toolbar-title>
        </q-toolbar>
        <!-- content slot -->
        <div class="col">
            <slot />
        </div>
        <!-- drawer content footer -->
        <q-list padding>
            <q-item :to="{name: 'settings'}">
                <q-item-section avatar>
                    <q-icon
                        size="sm"
                        name="settings"
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
                        name="history"
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
                        color="red"
                        class="q-mr-md"
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
                    return 'lite'
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
