<template>
    <q-dialog
        ref="dialog"
        @hide="$emit('hide')"
        :position="$q.screen.xs ? 'bottom': 'standard'"
        :no-backdrop-dismiss="!$q.screen.xs"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{opts.title}}</prompt-dialog-toolbar>
            <q-form @submit="onSubmit">
                <q-card-section>
                    <p class="prompt-message">{{opts.message}}</p>
                    <q-input
                        ref="input"
                        dense
                        autofocus
                        outlined
                        :error="!!error"
                        :error-message="error"
                        v-model="input"
                        :type="opts.password ? 'password' : 'text'"
                        autocomplete="off"
                        no-error-icon
                    />
                </q-card-section>
                <q-card-actions>
                    <q-btn
                        v-disableFocusHelper
                        class="full-width"
                        unelevated
                        :color="opts.action.color"
                        type="submit"
                        :label="opts.action.label"
                    />
                </q-card-actions>
            </q-form>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent, type ComponentPublicInstance } from 'vue'
import { QDialog } from 'quasar'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'

export type PromptOptions = {
    title: string
    message: string
    model: string
    action: {
        label: string
        color: string
    }
    validate: (input: string) => string
    /** a hidden input, for a password */
    password?: boolean
}

export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        opts: { type: Object as () => PromptOptions, required: true }
    },
    data() {
        return {
            input: this.opts.model,
            error: ''
        }
    },
    watch: {
        input() { this.error = '' }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        ok(input: string) {
            this.$emit('ok', input)
            this.hide()
        },
        async onSubmit() {
            (this.$refs.input as ComponentPublicInstance).$el.getElementsByTagName('input')[0].focus()

            const input = this.input
            if (input.length === 0) {
                return
            }

            this.error = ''
            await this.$nextTick()

            const error = this.opts.validate(input)
            if (error) {
                this.error = error
                return
            }
            this.ok(input)
        }
    }
})
</script>
<style lang="sass" scoped>
.prompt-message
  margin: 0 0 12px
  font-size: 14px
  line-height: 1.5
  color: $text-soft
</style>
