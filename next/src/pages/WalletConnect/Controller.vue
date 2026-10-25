<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('wc.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('wc.msg_intro')}}</p>

            <!-- a project id: needed once per build (or per device) -->
            <div
                v-if="!hasProject"
                class="bvm-tile q-pa-md q-mb-md"
            >
                <div class="text-weight-bold">{{$t('wc.title_project')}}</div>
                <p class="text-soft text-caption q-mt-xs">{{$t('wc.msg_project')}}</p>
                <q-input
                    v-model="project"
                    outlined
                    dense
                    spellcheck="false"
                    :label="$t('wc.label_project')"
                />
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    class="q-mt-sm"
                    :disable="!/^[0-9a-f]{32}$/i.test(project.trim())"
                    :label="$t('common.confirm')"
                    @click="saveProject()"
                />
            </div>

            <template v-else>
                <div class="row no-wrap q-gutter-x-sm">
                    <q-input
                        v-model="uri"
                        class="col"
                        outlined
                        dense
                        spellcheck="false"
                        :label="$t('wc.label_uri')"
                        :error="!!uriError"
                        :error-message="uriError"
                        no-error-icon
                        @keyup.enter="connect()"
                    />
                    <q-btn
                        :aria-label="$t('home.action_scan')"
                        outline
                        color="primary"
                        icon="o_qr_code_scanner"
                        style="height: 40px"
                        @click="scan()"
                    />
                </div>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    class="full-width q-mt-sm"
                    icon="o_link"
                    :loading="wc.connecting || starting"
                    :disable="!uri.trim()"
                    :label="$t('wc.action_connect')"
                    @click="connect()"
                />
                <div
                    v-if="wc.error === 'init'"
                    class="text-negative text-caption q-mt-sm"
                >{{$t('wc.msg_init_failed')}}</div>

                <div class="bvm-label q-mt-lg q-mb-sm">{{$t('wc.label_sessions')}}</div>
                <empty-state
                    v-if="!wc.sessions.length"
                    icon="o_link_off"
                    :text="$t('wc.msg_no_sessions')"
                />
                <q-list
                    v-else
                    class="bvm-list"
                >
                    <q-item
                        v-for="s in wc.sessions"
                        :key="s.topic"
                    >
                        <q-item-section avatar>
                            <q-avatar
                                rounded
                                size="36px"
                            >
                                <img
                                    v-if="/^https:/.test(s.icon)"
                                    :src="s.icon"
                                    alt=""
                                >
                                <q-icon
                                    v-else
                                    name="o_apps"
                                />
                            </q-avatar>
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label lines="1">{{s.name}}</q-item-label>
                            <q-item-label
                                caption
                                lines="1"
                            >{{host(s.url)}} · <address-label :addr="s.address" /></q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-btn
                                flat
                                no-caps
                                dense
                                color="negative"
                                :label="$t('wc.action_disconnect')"
                                @click="disconnect(s.topic)"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
            </template>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import AddressLabel from 'components/AddressLabel.vue'
import QrScannerDialog from 'pages/QrScannerDialog'
import { disconnect, pair, projectId, setProjectId, wc } from 'src/utils/walletconnect'

// connect dApps over WalletConnect, and see or end the connections
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressLabel },
    props: {
        /** a wc: link handed over (from a scan) */
        link: String
    },
    data: () => ({
        wc,
        uri: '',
        uriError: '',
        project: '',
        starting: false,
        hasProject: !!projectId()
    }),
    watch: {
        uri() { this.uriError = '' }
    },
    async created() {
        if (this.hasProject) {
            await this.start()
            if (this.link) {
                this.uri = this.link
                void this.connect()
            }
        }
    },
    methods: {
        host(url: string) {
            try {
                return new URL(url).host
            } catch {
                return url
            }
        },
        async start() {
            if (wc.ready) return
            this.starting = true
            // the host (pages/WalletConnect/Host.vue) starts it with the wallet's dialogs
            window.dispatchEvent(new Event('bv-wc-start'))
            for (let i = 0; i < 100 && !wc.ready && !wc.error; i++) {
                await new Promise(r => setTimeout(r, 100))
            }
            this.starting = false
        },
        saveProject() {
            setProjectId(this.project)
            this.hasProject = true
            void this.start()
        },
        async connect() {
            this.uriError = ''
            await this.start()
            try {
                await pair(this.uri)
                this.uri = ''
                this.$q.notify({ message: this.$t('wc.msg_waiting'), icon: 'o_link' })
            } catch {
                this.uriError = this.$t('wc.msg_bad_uri')
            }
        },
        async scan() {
            try {
                this.uri = (await this.$dialog<string>({ component: QrScannerDialog })).trim()
                await this.connect()
            } catch { }
        },
        async disconnect(topic: string) {
            await disconnect(topic)
        }
    }
})
</script>
