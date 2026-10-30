<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{$t('widgets.title')}}</prompt-dialog-toolbar>
            <q-list class="q-pb-sm">
                <q-item
                    v-for="(w, i) in widgets.list"
                    :key="w.key"
                >
                    <q-item-section avatar>
                        <q-icon :name="icons[w.key]" />
                    </q-item-section>
                    <q-item-section>{{$t(`widgets.${w.key}`)}}</q-item-section>
                    <q-item-section side>
                        <div class="row no-wrap items-center">
                            <q-btn
                                flat
                                round
                                dense
                                icon="keyboard_arrow_up"
                                :disable="i === 0"
                                :aria-label="$t('widgets.action_up')"
                                @click="move(i, -1)"
                            />
                            <q-btn
                                flat
                                round
                                dense
                                icon="keyboard_arrow_down"
                                :disable="i === widgets.list.length - 1"
                                :aria-label="$t('widgets.action_down')"
                                @click="move(i, 1)"
                            />
                            <q-toggle
                                v-model="w.on"
                                color="primary"
                            />
                        </div>
                    </q-item-section>
                </q-item>
            </q-list>
            <q-card-actions class="q-px-md q-pb-md">
                <q-btn
                    flat
                    no-caps
                    :label="$t('widgets.action_reset')"
                    @click="resetWidgets()"
                />
                <q-space />
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    :label="$t('common.finish')"
                    @click="hide()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'
import { homeWidgets, resetWidgets, type WidgetKey } from './widgets'

// what the home screen shows, and in which order
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    data: () => ({
        widgets: homeWidgets,
        icons: {
            portfolio: 'o_show_chart',
            actions: 'o_bolt',
            resend: 'o_replay',
            tokens: 'o_toll',
            watchlist: 'o_visibility',
            launchpad: 'o_rocket_launch',
            addresses: 'o_credit_card'
        } as Record<WidgetKey, string>
    }),
    methods: {
        resetWidgets,
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        move(i: number, by: number) {
            const list = [...homeWidgets.list]
            const [w] = list.splice(i, 1)
            list.splice(i + by, 0, w!)
            homeWidgets.list = list
        }
    }
})
</script>
