<template>
    <div>
        <signer-item
            :text="signer"
            :caption="group? group.name : ''"
            :sideIcon="count > 1 ? 'unfold_more': ''"
            :clickable="count > 1"
        />
        <q-popup-proxy
            v-if="count > 1"
            position="bottom"
            fit
            @show="onPopupShow()"
        >
            <q-card>
                <q-list padding>
                    <template
                        v-for="(g, gi) in groups"
                        :key="`g-${gi}`"
                    >
                        <q-item-label
                            header
                            class="ellipsis"
                        >{{g.name}}</q-item-label>
                        <signer-item
                            :ref="addr"
                            v-close-popup
                            clickable
                            v-for="(addr, ai) in g.addresses"
                            :key="`a-${gi}-${ai}`"
                            :text="addr"
                            :active="signer === addr"
                            @click="$emit('select', addr)"
                        />
                    </template>
                </q-list>
            </q-card>
        </q-popup-proxy>
    </div>
</template>
<script lang="ts">
import { defineComponent, type ComponentPublicInstance } from 'vue'
import SignerItem from './SignerItem.vue'
import { count } from 'src/utils/array'
import { SignerGroup } from './models'

export default defineComponent({
    emits: ['select'],
    components: { SignerItem },
    props: {
        signer: String,
        groups: { type: Array as () => SignerGroup[], required: true }
    },
    computed: {
        group(): SignerGroup | null {
            return this.groups.find(g => g.addresses.includes(this.signer || '')) || null
        },
        count(): number {
            return count(this.groups, g => g.addresses.length)
        }
    },
    methods: {
        onPopupShow() {
            const item = this.$refs[this.signer || ''] as ComponentPublicInstance[] | undefined
            if (item && item[0]) {
                item[0].$el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
        }
    }
})
</script>
