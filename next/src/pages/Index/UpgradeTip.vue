<template>
    <div class="q-pa-xs">
        <q-banner
            dark
            dense
            rounded
            inline-actions
            class="bg-positive"
        >
            <template v-slot:avatar>
                <q-icon name="upgrade" />
            </template>
            {{$t('index.msg_upgrade')}}
            <template v-slot:action>
                <q-btn
                    @click="reloadApp"
                    flat
                    :label="$t('index.action_upgrade')"
                />
            </template>
        </q-banner>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
    methods: {
        reloadApp() {
            // the desktop app installs its update here instead (phase 5)
            window.location.reload()
        }
    }
})
</script>
