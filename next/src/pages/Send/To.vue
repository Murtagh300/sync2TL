<template>
    <q-input
        outlined
        no-error-icon
        autocomplete="off"
        v-bind="$attrs"
        dense
        placeholder="0x"
        clearable
        v-model.lazy="to"
        spellcheck="false"
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
    emits: ['update:address'],
    data() {
        return {
            to: this.address || '',
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
            this.$emit('update:address', v)
        }
    },
    methods: {
        isAddress: address.test,
        onSelectAddress(addr: string) {
            this.to = address.toChecksumed(addr)
        },
        async onClickScan() {
            try {
                this.to = await this.$dialog<string>({ component: QrScannerDialog })
            } catch { }
        }
    }
})
</script>
