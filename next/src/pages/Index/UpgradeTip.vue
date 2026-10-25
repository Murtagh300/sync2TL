<template>
    <div class="q-px-md q-pt-md">
        <div class="bvm-tile upgrade-tip row no-wrap items-center q-pa-md">
            <q-icon
                name="o_upgrade"
                size="22px"
                color="primary"
                class="q-mr-md"
            />
            <div class="col text-weight-bold">{{$t('index.msg_upgrade')}}</div>
            <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                class="q-px-md q-ml-sm"
                :label="$t('index.action_upgrade')"
                @click="reloadApp"
            />
        </div>
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
<style lang="sass" scoped>
.upgrade-tip
  border-color: rgba(110, 231, 183, 0.35)
</style>
