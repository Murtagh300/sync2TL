<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('settings.action_nodes')">
            <q-btn
                class="q-ml-auto"
                flat
                round
                icon="add"
                @click="onAdd"
            />
        </page-toolbar>
        <page-content class="col">
            <div class="q-pa-md">
                <template
                    v-for="(group, gi) in groups"
                    :key="gi"
                >
                    <div class="bvm-label q-mb-sm q-ml-xs">{{$netDisplayName(group.list[0].genesis.id)}}</div>
                    <q-list class="bvm-list q-mb-lg">
                        <q-item
                            v-for="(node, i) in group.list"
                            :key="`${gi}-${i}`"
                            clickable
                            @click="onSelect(node)"
                        >
                            <q-item-section avatar>
                                <q-icon
                                    :color="group.selection === i ? 'primary' : 'grey-8'"
                                    :name="group.selection === i ? 'radio_button_checked' : 'radio_button_unchecked'"
                                />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label lines="1">{{nodeName(node)}}</q-item-label>
                                <q-item-label
                                    lines="1"
                                    caption
                                >{{node.url}}</q-item-label>
                            </q-item-section>
                            <q-item-section
                                v-if="canDelete(node)"
                                side
                            >
                                <q-btn
                                    @click.prevent.stop="onDelete(node)"
                                    flat
                                    dense
                                    round
                                    icon="o_delete"
                                />
                            </q-item-section>
                        </q-item>
                    </q-list>
                </template>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import AddDialog from './AddDialog.vue'
import { count, groupBy } from 'src/utils/array'
import PageContent from 'components/PageContent.vue'
import PageToolbar from 'components/PageToolbar.vue'

type NodeGroup = { list: M.Node[], selection: number }

export default defineComponent({
    components: { PageContent, PageToolbar },
    data() {
        return {
            activeMap: null as Record<string, string> | null,
            addNodeState: { url: '' },
            // async computed (see src/shims-async-computed.d.ts)
            nodes: [] as M.Node[]
        }
    },
    asyncComputed: {
        nodes: {
            async get() {
                if (!this.activeMap) {
                    this.activeMap = await this.$svc.config.node.activeMap()
                }
                return this.$svc.config.node.all()
            },
            default: []
        }
    },
    computed: {
        groups(): NodeGroup[] {
            const groups = groupBy(this.nodes, n => n.genesis.id)
                .map<NodeGroup>(v => ({ list: v, selection: 0 }))

            const activeMap = this.activeMap || {}
            // normalize selection according to activeMap
            groups.forEach(g => {
                const sel = g.list.findIndex(n => activeMap[n.genesis.id] === n.url)
                g.selection = sel < 0 ? 0 : sel
            })
            return groups
        }
    },
    methods: {
        nodeName(node: M.Node) {
            try {
                const url = new URL(node.url)
                return url.hostname.split('.').slice(-2).join('.')
            } catch {
                return node.url
            }
        },
        canDelete(val: M.Node) {
            return !val.preset &&
                count(this.nodes, n => n.genesis.id === val.genesis.id ? 1 : 0) > 1
        },
        onSelect(val: M.Node) {
            if (!this.activeMap) {
                return
            }
            this.activeMap[val.genesis.id] = val.url
        },
        async onAdd() {
            try {
                const node = await this.$dialog<M.Node>({
                    component: AddDialog,
                    state: this.addNodeState
                })

                if (this.nodes.find(n => n.genesis.id === node.genesis.id && n.url === node.url)) {
                    this.$q.notify({
                        type: 'warning',
                        message: this.$t('nodes.msg_node_existed').toString()
                    })
                    return
                }
                await this.$svc.config.node.save([...this.nodes, node])
                this.$q.notify(this.$t('nodes.msg_node_added').toString())
                this.addNodeState.url = ''
            } catch { }
        },
        async onDelete(val: M.Node) {
            try {
                await this.$dialog({
                    focus: 'cancel',
                    title: this.$t('common.delete').toString(),
                    message: this.$t('nodes.msg_delete').toString(),
                    ok: {
                        label: this.$t('common.delete'),
                        color: 'negative',
                        outline: true
                    },
                    cancel: {
                        label: this.$t('common.cancel'),
                        unelevated: true
                    }
                })
                const nodes = this.nodes.filter(n => !(n.genesis.id === val.genesis.id && n.url === val.url))
                await this.$svc.config.node.save(nodes)
                this.$q.notify(this.$t('nodes.msg_node_deleted').toString())
            } catch { }
        }
    },
    beforeUnmount() {
        if (this.activeMap) {
            this.$svc.config.node.saveActiveMap(this.activeMap)
                .catch(err => console.warn(err))
        }
    }
})
</script>
