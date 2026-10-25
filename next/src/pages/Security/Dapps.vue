<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('dapps.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('dapps.msg_intro')}}</p>
            <empty-state
                v-if="!dapps.length"
                icon="o_apps"
                :text="$t('dapps.msg_none')"
                :action="$t('empty.action_discover')"
                action-icon="o_explore"
                @action="$router.push({ name: 'index' })"
            />
            <q-list
                v-else
                class="bvm-list"
            >
                <q-item
                    v-for="d in dapps"
                    :key="d.host"
                >
                    <q-item-section avatar>
                        <q-avatar rounded>
                            <img
                                :src="`${d.origin}/favicon.ico`"
                                alt=""
                                @error="($event.target as HTMLImageElement).style.visibility = 'hidden'"
                            >
                        </q-avatar>
                    </q-item-section>
                    <q-item-section style="min-width: 0">
                        <q-item-label lines="1">{{d.host}}</q-item-label>
                        <q-item-label caption>
                            {{$t('dapps.label_uses', { txs: d.txs, certs: d.certs })}} · {{ago(d.last)}}
                        </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <q-btn
                            flat
                            dense
                            no-caps
                            color="negative"
                            :label="$t('dapps.action_forget')"
                            @click="forget(d)"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import { dappsFromActivity, type DappUse } from 'src/utils/dapps'
import { formatDate } from 'src/utils/format'

// the sites the wallet signed for; forgetting one removes its records from this device
export default defineComponent({
    components: { EmptyState, PageToolbar, PageContent },
    data: () => ({
        dapps: [] as DappUse[]
    }),
    async created() {
        await this.load()
    },
    methods: {
        async load() {
            this.dapps = dappsFromActivity(await this.$svc.activity.page(1000, 0))
        },
        ago(t: number) {
            return formatDate(t, { relative: true })
        },
        async forget(d: DappUse) {
            try {
                await new Promise<void>((resolve, reject) => {
                    this.$q.dialog({
                        title: this.$t('dapps.title_forget', { host: d.host }),
                        message: this.$t('dapps.msg_forget'),
                        cancel: true,
                        ok: { label: this.$t('dapps.action_forget'), color: 'negative', flat: true }
                    }).onOk(() => resolve()).onCancel(() => reject(new Error('cancel')))
                })
            } catch {
                return
            }
            for (const id of d.activityIds) {
                await this.$svc.activity.remove(id)
            }
            await this.load()
        }
    }
})
</script>
