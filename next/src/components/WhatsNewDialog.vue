<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="onDialogHide"
    >
        <q-card class="whats-new">
            <q-card-section>
                <div class="text-h6 text-weight-bold">{{$t('whatsNew.title')}}</div>
                <div class="text-muted version">BlackVault {{release.version}} · {{release.date}}</div>
            </q-card-section>
            <q-card-section class="q-pt-none">
                <ul class="q-pl-md q-my-none">
                    <li
                        v-for="(line, i) in lines"
                        :key="i"
                        class="q-mb-sm"
                    >{{line}}</li>
                </ul>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md">
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    class="full-width"
                    :label="$t('common.ok')"
                    @click="onOKClick"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { QDialog } from 'quasar'
import { releaseItems, type Release } from 'src/changelog'

// what changed in this version (src/changelog.ts)
export default defineComponent({
    props: {
        release: { type: Object as PropType<Release>, required: true }
    },
    emits: ['ok', 'hide'],
    computed: {
        lines(): string[] {
            return releaseItems(this.release, this.$i18n.locale)
        }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() {
            (this.$refs.dialog as QDialog).show()
        },
        // method is REQUIRED by $q.dialog
        hide() {
            (this.$refs.dialog as QDialog).hide()
        },
        onDialogHide() {
            this.$emit('hide')
        },
        onOKClick() {
            this.$emit('ok')
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
.whats-new
  width: 100%
  max-width: 520px

.version
  font-size: 12px
</style>
