<template>
    <q-input
        outlined
        no-error-icon
        autocomplete="off"
        v-bind="$attrs"
        dense
        :placeholder="$t('send.placeholder_to')"
        :aria-label="$t('send.label_to')"
        clearable
        v-model.lazy="to"
        spellcheck="false"
        :loading="resolving"
        :hint="pasteNote || (resolvedFrom ? $t('send.msg_resolved', { name: resolvedFrom }) : knownName ? $t('send.msg_known_as', { name: knownName }) : undefined)"
        :input-class="isAddress(to) ? 'to-address' : ''"
        :error="!!vetError || $attrs.error === true"
        :error-message="vetError || ($attrs['error-message'] as string)"
        @paste="onPaste"
    >
        <template
            v-if="isAddress(to)"
            v-slot:prepend
        >
            <AddressAvatar :addr="to" />
        </template>
        <template v-slot:append>
            <q-btn
                v-show="hasCamera && !to"
                rounded
                dense
                icon="qr_code_scanner"
                flat
                @click.stop="onClickScan"
            />
        </template>
        <q-popup-proxy
            :no-parent-event="!!to"
            position="bottom"
            fit
        >
            <q-card>
                <q-list padding>
                    <template
                        v-for="(group, gi) in wallets"
                        :key="gi"
                    >
                        <q-item-label
                            header
                        >
                            {{group.name}}
                        </q-item-label>
                        <template
                            v-for="(addr, ai) in group.list"
                            :key="`${gi}-${ai}`"
                        >
                            <AddressItem
                                clickable
                                v-close-popup
                                @click="onSelectAddress(addr)"
                                :address="addr"
                            />
                        </template>
                    </template>
                </q-list>
            </q-card>
        </q-popup-proxy>
    </q-input>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address } from 'thor-devkit'
import AddressAvatar from 'src/components/AddressAvatar.vue'
import { AddressGroup } from './models'
import AddressItem from './AddressItem.vue'
import QrScannerDialog from 'pages/QrScannerDialog'
import { QrScanner } from 'src/utils/qr-scanner'
import { isVetName, nameOf, resolveVetName } from 'src/utils/names'
import { parsePaymentRequest } from 'src/utils/payment-request'
import { checkPasted } from 'src/utils/clipboard-guard'
import { haptic } from 'src/utils/prefs'

export default defineComponent({
    components: {
        AddressAvatar,
        AddressItem
    },
    props: {
        wallets: {
            type: Array as () => AddressGroup[],
            default: () => []
        },
        // v-model:address
        address: String as () => string | null
    },
    emits: ['update:address', 'request'],
    data() {
        return {
            to: this.address || '',
            resolving: false,
            resolvedFrom: '',
            resolvedAddress: '',
            vetError: '',
            /** what to say about a pasted address that isn't the one just copied */
            pasteNote: '',
            pasted: '',
            // async computed (see src/shims-async-computed.d.ts)
            hasCamera: null as boolean | null
        }
    },
    asyncComputed: {
        hasCamera(): Promise<boolean> {
            // the native app (phase 6) assumes all mobile devices have a camera
            return QrScanner.hasCamera()
        }
    },
    watch: {
        address(v: string) {
            this.to = v
        },
        to(v: string) {
            this.vetError = ''
            this.pasteNote = ''
            const pasted = this.pasted
            this.pasted = ''
            if (v && pasted && v.trim().toLowerCase() === pasted.trim().toLowerCase()) {
                const r = checkPasted(pasted)
                if (r === 'swapped') {
                    haptic('error')
                    this.vetError = this.$t('send.msg_paste_swapped')
                    return
                }
                if (r === 'different') this.pasteNote = this.$t('send.msg_paste_different')
            }
            if (v && isVetName(v)) {
                void this.resolve(v)
                return
            }
            if (v && v.toLowerCase() !== this.resolvedAddress) {
                this.resolvedFrom = ''
            }
            this.$emit('update:address', v)
        }
    },
    computed: {
        /** the name this address goes by (a contact, a wallet, a .vet name) */
        knownName(): string {
            return this.isAddress(this.to) ? nameOf(this.to) : ''
        }
    },
    methods: {
        onPaste(e: ClipboardEvent) {
            this.pasted = e.clipboardData?.getData('text') || ''
        },
        isAddress: address.test,
        async resolve(name: string) {
            this.resolving = true
            try {
                const resolved = await resolveVetName(name)
                if (this.to !== name) {
                    return // typed on meanwhile
                }
                if (resolved) {
                    this.resolvedFrom = name.trim().toLowerCase()
                    this.resolvedAddress = resolved.toLowerCase()
                    this.to = address.toChecksumed(resolved)
                } else {
                    this.vetError = this.$t('send.msg_vet_not_found', { name })
                }
            } catch {
                this.vetError = this.$t('common.something_wrong')
            } finally {
                this.resolving = false
            }
        },
        onSelectAddress(addr: string) {
            this.to = address.toChecksumed(addr)
        },
        async onClickScan() {
            try {
                const scanned = await this.$dialog<string>({ component: QrScannerDialog })
                const req = parsePaymentRequest(scanned)
                if (req) {
                    this.to = address.toChecksumed(req.to)
                    this.$emit('request', req)
                } else {
                    this.to = scanned
                }
            } catch { }
        }
    }
})
</script>
<style lang="sass">
// a whole address fits the field: smaller, even-width digits
.to-address
  font-size: 12px !important
  font-variant-numeric: tabular-nums
  letter-spacing: -0.01em
</style>
