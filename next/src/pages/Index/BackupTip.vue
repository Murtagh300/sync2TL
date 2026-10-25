<template>
    <div>
        <q-slide-transition>
            <div v-show="!dismissed">
                <div class="q-px-md q-pt-md">
                    <div class="bvm-tile backup-tip row no-wrap items-start q-pa-md">
                        <q-icon
                            name="o_shield"
                            size="22px"
                            color="warning"
                            class="q-mr-md q-mt-xs"
                        />
                        <div class="col">
                            <div class="tip-text">{{$t('index.msg_backup')}}</div>
                            <div class="row q-gutter-sm q-mt-sm">
                                <q-btn
                                    unelevated
                                    dense
                                    no-caps
                                    color="primary"
                                    class="q-px-md"
                                    :label="$t('index.action_backup_now')"
                                    @click="$emit('backup')"
                                />
                                <q-btn
                                    flat
                                    dense
                                    no-caps
                                    class="q-px-sm text-muted"
                                    :label="$t('common.dismiss')"
                                    @click="dismissed=true"
                                />
                            </div>
                        </div>
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
  border-color: rgba(251, 191, 36, 0.35)

.tip-text
  font-size: 14px
  font-weight: 600
  line-height: 1.4
  color: $text-soft
</style>
