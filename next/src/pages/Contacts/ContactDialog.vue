<template>
    <q-dialog
        ref="dialog"
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width">
            <prompt-dialog-toolbar>{{contact ? $t('contacts.title_edit') : $t('contacts.title_add')}}</prompt-dialog-toolbar>
            <q-form @submit="onSubmit">
                <q-card-section class="q-gutter-y-sm">
                    <q-input
                        v-model="name"
                        outlined
                        dense
                        autofocus
                        :label="$t('contacts.label_name')"
                        :error="!!nameError"
                        :error-message="nameError"
                        no-error-icon
                    />
                    <q-input
                        v-model="addr"
                        outlined
                        dense
                        spellcheck="false"
                        autocomplete="off"
                        :label="$t('contacts.label_address')"
                        :loading="resolving"
                        :error="!!addrError"
                        :error-message="addrError"
                        no-error-icon
                    />
                    <q-select
                        v-model="groups"
                        outlined
                        dense
                        multiple
                        use-chips
                        use-input
                        new-value-mode="add-unique"
                        hide-dropdown-icon
                        input-debounce="0"
                        :options="groupOptions"
                        :label="$t('contacts.label_groups')"
                        :hint="$t('contacts.hint_groups')"
                    />
                </q-card-section>
                <q-card-actions class="q-px-md q-pb-md">
                    <q-btn
                        class="full-width"
                        unelevated
                        color="primary"
                        type="submit"
                        :loading="resolving"
                        :label="$t('common.confirm')"
                    />
                </q-card-actions>
            </q-form>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import { address } from 'thor-devkit'
import PromptDialogToolbar from 'src/components/PromptDialogToolbar.vue'
import { isVetName, resolveVetName, type Contact } from 'src/utils/names'
import { SUGGESTED_GROUPS } from 'src/utils/last-payments'

// add or change a contact; the address may be typed as a .vet name
export default defineComponent({
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PromptDialogToolbar },
    props: {
        contact: Object as () => Contact | undefined,
        /** groups other contacts already use */
        knownGroups: { type: Array as () => string[], default: () => [] }
    },
    data() {
        return {
            name: this.contact?.name || '',
            addr: this.contact?.address || '',
            groups: [...(this.contact?.groups || [])] as string[],
            nameError: '',
            addrError: '',
            resolving: false
        }
    },
    computed: {
        groupOptions(): string[] {
            const suggested = SUGGESTED_GROUPS.map(g => this.$t(`contacts.group_${g}`))
            return [...new Set([...this.knownGroups, ...suggested])]
        }
    },
    watch: {
        name() { this.nameError = '' },
        addr() { this.addrError = '' }
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        async onSubmit() {
            const name = this.name.trim()
            let addr = this.addr.trim()
            if (!name) {
                this.nameError = this.$t('common.required_field')
            }
            if (isVetName(addr)) {
                this.resolving = true
                try {
                    addr = (await resolveVetName(addr)) || ''
                } catch {
                    addr = ''
                } finally {
                    this.resolving = false
                }
                if (!addr) {
                    this.addrError = this.$t('send.msg_vet_not_found', { name: this.addr.trim() })
                    return
                }
            } else if (!address.test(addr)) {
                this.addrError = this.$t('send.msg_invalid_address')
            }
            if (this.nameError || this.addrError) {
                return
            }
            const groups = [...new Set(this.groups.map(g => String(g).trim()).filter(Boolean))]
            this.$emit('ok', { name, address: address.toChecksumed(addr), ...(groups.length ? { groups } : {}) } as Contact)
            this.hide()
        }
    }
})
</script>
