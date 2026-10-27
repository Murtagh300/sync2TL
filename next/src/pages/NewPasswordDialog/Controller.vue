<template>
    <q-dialog
        ref="dialog"
        @show="focus()"
        @hide="$emit('hide')"
        :position="$q.screen.xs ? 'bottom': 'standard'"
        :no-backdrop-dismiss="!$q.screen.xs"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{hint}}</prompt-dialog-toolbar>
            <q-form @submit="onSubmit()">
                <q-card-section>
                    <!-- prevent chrome warning -->
                    <q-input
                        v-show="false"
                        model-value=""
                        autocomplete="username"
                    />
                    <q-input
                        autofocus
                        class="q-mx-xl"
                        ref="pwd"
                        dense
                        input-class="text-center"
                        no-error-icon
                        :error="!!error"
                        :error-message="error"
                        v-model="inputValue"
                        outlined
                        :type="reveal ? 'text' : 'password'"
                        autocomplete="new-password"
                        :hint="password ? '' : $t('newPasswordDialog.msg_min_length', { n: minLength })"
                    >
                        <template #append>
                            <q-btn
                                flat
                                round
                                dense
                                size="sm"
                                :icon="reveal ? 'o_visibility_off' : 'o_visibility'"
                                :aria-label="$t(reveal ? 'newPasswordDialog.action_hide' : 'newPasswordDialog.action_show')"
                                @click="reveal = !reveal"
                            />
                        </template>
                    </q-input>
                    <div
                        v-if="!password && inputValue"
                        class="strength q-mx-xl q-mt-xs"
                    >
                        <div class="strength-bar row no-wrap">
                            <span
                                v-for="i in 4"
                                :key="i"
                                class="col"
                                :class="i <= strength ? `strength-on strength-${strength}` : ''"
                            />
                        </div>
                        <div
                            class="strength-label"
                            :class="`strength-text-${strength}`"
                        >{{$t(`newPasswordDialog.strength_${strength}`)}}</div>
                    </div>
                </q-card-section>
                <q-card-actions>
                    <q-btn
                        v-disableFocusHelper
                        class="full-width"
                        :label="action"
                        unelevated
                        color="primary"
                        type="submit"
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

const MIN_PASSWORD_LEN = 6

export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    data: () => {
        return {
            password: '',
            inputValue: '',
            error: '',
            // the password in plain text, while the user wants to check what they typed
            reveal: false,
            minLength: MIN_PASSWORD_LEN
        }
    },
    computed: {
        /** 1 weak … 4 strong: length and variety of characters */
        strength(): number {
            const v = this.inputValue
            let score = 0
            if (v.length >= 8) score++
            if (v.length >= 12) score++
            if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++
            if (/\d/.test(v)) score++
            if (/[^A-Za-z0-9]/.test(v)) score++
            return Math.max(1, Math.min(4, score))
        },
        hint(): string {
            return this.password
                ? this.$t('newPasswordDialog.title_confirm_password').toString()
                : this.$t('newPasswordDialog.title_set_new_password').toString()
        },
        action(): string {
            return this.password
                ? this.$t('common.confirm').toString()
                : this.$t('common.next').toString()
        }
    },
    watch: {
        inputValue() { this.error = '' }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        // autofocus doesn't reach the field while the dialog slides in
        focus() {
            (this.$refs.pwd as ComponentPublicInstance | undefined)?.$el.getElementsByTagName('input')[0]?.focus()
        },
        ok(result: string) {
            this.$emit('ok', result)
            this.hide()
        },
        async onSubmit() {
            this.focus()

            if (this.inputValue.length === 0) {
                return
            }
            this.error = ''
            await this.$nextTick()
            if (this.password) {
                if (this.inputValue !== this.password) {
                    this.inputValue = ''
                    this.password = ''
                    await this.$nextTick()
                    this.error = this.$t('newPasswordDialog.msg_password_mismatch').toString()
                    return
                }
                this.ok(this.password)
            } else {
                if (this.inputValue.length < MIN_PASSWORD_LEN) {
                    this.error = this.$t('newPasswordDialog.msg_password_too_short').toString()
                    return
                }
                this.password = this.inputValue
                this.inputValue = ''
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.strength-bar
  gap: 4px
  span
    height: 4px
    border-radius: 2px
    background: rgba(255, 255, 255, 0.1)

.strength-on.strength-1
  background: $negative
.strength-on.strength-2
  background: $warning
.strength-on.strength-3, .strength-on.strength-4
  background: var(--q-primary)

.strength-label
  margin-top: 4px
  font-size: 12px
  font-weight: 700
  text-align: center

.strength-text-1
  color: $negative
.strength-text-2
  color: $warning
.strength-text-3, .strength-text-4
  color: var(--q-primary)
</style>
