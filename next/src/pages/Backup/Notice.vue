<template>
    <div class="backup-notice q-pa-md">
        <div class="backup-mark flex flex-center q-mb-lg">
            <q-icon
                name="o_key"
                size="40px"
                color="primary"
            />
        </div>
        <h1 class="bvm-display backup-title q-my-none">{{$t('backup.label_backup_tips')}}<help-tip term="recovery" /></h1>
        <p class="text-soft q-mt-md q-mb-lg">{{$t('backup.msg_backup_intro')}}</p>
        <q-list role="group" class="bvm-list">
            <q-item
                v-for="tip in tips"
                :key="tip.icon"
            >
                <q-item-section avatar>
                    <q-avatar :icon="tip.icon" />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{tip.text}}</q-item-label>
                </q-item-section>
            </q-item>
        </q-list>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import HelpTip from 'components/HelpTip.vue'
export default defineComponent({
    components: { HelpTip },
    computed: {
        tips(): { icon: string, text: string }[] {
            return [
                { icon: 'o_edit', text: this.$t('backup.msg_backup_tips_1') },
                { icon: 'o_lock', text: this.$t('backup.msg_backup_tips_2') },
                { icon: 'o_no_photography', text: this.$t('backup.msg_backup_tips_3') }
            ]
        }
    }
})
</script>
<style lang="sass" scoped>
.backup-mark
  width: 76px
  height: 76px
  border-radius: 20px
  border: 1px solid color-mix(in srgb, var(--q-primary) 35%, transparent)
  background: color-mix(in srgb, var(--q-primary) 08%, transparent)

.backup-title
  font-size: 34px
</style>
