<template>
    <q-btn
        flat
        round
        dense
        size="xs"
        icon="o_help_outline"
        class="help-tip text-muted"
        :aria-label="$t(`help.${term}_title`)"
        @click.stop="open = true"
    >
        <q-dialog
            v-model="open"
            :position="$q.screen.xs ? 'bottom' : 'standard'"
        >
            <q-card class="help-card">
                <q-card-section>
                    <div class="bvm-display help-title">{{$t(`help.${term}_title`)}}</div>
                    <p class="text-soft q-mt-sm q-mb-none help-body">{{$t(`help.${term}`)}}</p>
                </q-card-section>
                <q-card-actions class="q-px-md q-pb-md">
                    <q-btn
                        v-close-popup
                        class="full-width"
                        unelevated
                        no-caps
                        color="primary"
                        :label="$t('help.action_got_it')"
                    />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </q-btn>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export type HelpTerm = 'vtho' | 'gas' | 'approval' | 'floor' | 'vvet' | 'recovery' | 'sponsor' | 'slippage'

// a small (?) next to a term: tap for a plain explanation
export default defineComponent({
    props: {
        term: { type: String as () => HelpTerm, required: true }
    },
    data: () => ({ open: false })
})
</script>
<style lang="sass" scoped>
.help-tip
  margin-left: 2px
  vertical-align: middle

.help-card
  max-width: 420px

.help-title
  font-size: 22px

.help-body
  line-height: 1.5
</style>
