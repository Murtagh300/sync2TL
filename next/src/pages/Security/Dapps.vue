<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('dapps.title')" />
        <page-content
            class="col"
            padding
        >
            <div class="bvm-label q-pb-sm row items-center no-wrap">
                <span class="col">{{$t('dapps.label_live')}}</span>
                <q-btn
                    v-if="wc.sessions.length > 1"
                    flat
                    dense
                    no-caps
                    color="negative"
                    :label="$t('dapps.action_disconnect_all')"
                    :loading="busy"
                    @click="disconnectAll()"
                />
            </div>
            <q-list
                v-if="wc.sessions.length"
                role="list"
                class="bvm-list q-mb-sm"
            >
                <q-item
                    v-for="s in wc.sessions"
                    :key="s.topic"
                >
                    <q-item-section avatar>
                        <q-avatar rounded>
                            <img
                                v-if="s.icon"
                                :src="s.icon"
                                alt=""
                            >
                            <q-icon
                                v-else
                                name="o_link"
                            />
                        </q-avatar>
                    </q-item-section>
                    <q-item-section style="min-width: 0">
                        <q-item-label lines="1">{{s.name}}</q-item-label>
                        <q-item-label caption>
                            WalletConnect · <address-label
                                :addr="s.address"
                                no-icon
                            />
                        </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <q-btn
                            flat
                            dense
                            no-caps
                            color="negative"
                            :label="$t('dapps.action_disconnect')"
                            @click="disconnectOne(s.topic)"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
            <p
                v-else
                class="text-caption text-muted q-mb-sm"
            >{{wc.ready ? $t('dapps.msg_no_live') : $t('dapps.msg_wc_off')}}</p>
            <q-list
                role="list"
                class="bvm-list q-mb-lg"
            >
                <q-item
                    clickable
                    @click="openApprovals()"
                >
                    <q-item-section avatar>
                        <q-icon
                            name="o_verified_user"
                            color="primary"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>{{$t('dapps.label_approvals')}}</q-item-label>
                        <q-item-label caption>{{$t('dapps.msg_approvals')}}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <q-icon name="o_chevron_right" />
                    </q-item-section>
                </q-item>
            </q-list>
            <div class="bvm-label q-pb-sm">{{$t('dapps.label_sites')}}</div>
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
                role="group"
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
import AddressLabel from 'components/AddressLabel.vue'
import { dappsFromActivity, type DappUse } from 'src/utils/dapps'
import { disconnect, wc } from 'src/utils/walletconnect'
import { genesises } from 'src/consts'
import { formatDate } from 'src/utils/format'

// the sites the wallet signed for; forgetting one removes its records from this device
export default defineComponent({
    components: { EmptyState, PageToolbar, PageContent, AddressLabel },
    data: () => ({
        dapps: [] as DappUse[],
        wc,
        busy: false
    }),
    async created() {
        await this.load()
    },
    methods: {
        async load() {
            this.dapps = dappsFromActivity(await this.$svc.activity.page(1000, 0))
        },
        async openApprovals() {
            const w = (await this.$svc.wallet.all()).find(x => x.gid === genesises.main.id)
            if (w) void this.$router.push({ name: 'approvals', params: { walletId: String(w.id), addressIndex: '0' } })
        },
        async disconnectOne(topic: string) {
            await disconnect(topic).catch(() => { })
        },
        /** every live WalletConnect session at once: a dApp that asks again must be approved again */
        async disconnectAll() {
            this.busy = true
            try {
                for (const s of [...wc.sessions]) await disconnect(s.topic).catch(() => { })
                this.$q.notify(this.$t('dapps.msg_disconnected_all'))
            } finally {
                this.busy = false
            }
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
