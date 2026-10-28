<template>
    <div>
        <q-slide-transition>
            <div v-show="!dismissed">
                <!-- one slim row, so the total stays at the top of the screen -->
                <div class="q-px-md q-pt-sm">
                    <div class="bvm-tile backup-tip row no-wrap items-center">
                        <q-icon
                            name="o_shield"
                            size="20px"
                            color="warning"
                            class="q-mr-sm"
                        />
                        <div class="col tip-text">{{$t('index.msg_backup_short')}}</div>
                        <q-btn
                            unelevated
                            dense
                            no-caps
                            color="primary"
                            class="q-px-md tip-btn"
                            :label="$t('index.action_backup_now')"
                            @click="$emit('backup')"
                        />
                        <q-btn
                            flat
                            round
                            dense
                            size="sm"
                            icon="close"
                            class="text-muted q-ml-xs"
                            :aria-label="$t('common.dismiss')"
                            @click="dismissed=true"
                        />
                    </div>
                </div>
            </div>
        </q-slide-transition>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
    emits: ['backup'],
    data: () => {
        return {
            dismissed: false
        }
    }
})
</script>
<style lang="sass" scoped>
.backup-tip
  padding: 8px 8px 8px 14px
  border-color: rgba(251, 191, 36, 0.35)

.tip-text
  font-size: 13px
  font-weight: 700
  line-height: 1.3
  color: $text-soft

.tip-btn
  min-height: 32px
</style>
