<template>
    <div class="column fit no-wrap">
        <page-toolbar
            :title="$t('sign.title')"
            :gid="request?.gid"
        />
        <page-content
            class="col q-py-md"
            innerClass="fit column"
        >
            <!-- content -->
            <TxSummary
                v-if="request"
                :request="request"
            />
            <div
                v-else
                class="q-my-auto text-center"
            >
                <!-- loading -->
                <delay-render
                    v-if="$asyncComputed.request?.updating"
                    :t="200"
                >
                    <p>
                        <q-spinner-dots class="text-h2" />
                    </p>
                    <p>{{$t('sign.msg_loading_content')}}</p>
                </delay-render>
                <!-- error -->
                <template v-else-if="$asyncComputed.request?.exception">
                    <p>
                        <q-icon
                            name="error"
                            class="text-negative text-h2"
                        />
                    </p>
                    <p>{{$t('sign.msg_loading_failed')}}</p>
                    <p class="text-negative">{{$asyncComputed.request?.exception.message}}</p>
                </template>
            </div>
        </page-content>
        <!-- actions -->
        <page-action>
            <template v-if="request">
                <q-btn
                    outline
                    :label="$t('common.decline')"
                    color="negative"
                    @click="decline()"
                />
                <q-btn
                    unelevated
                    :label="$t('common.continue')"
                    color="primary"
                    @click="signRequest()"
                />
            </template>
            <q-btn
                v-else-if="$asyncComputed.request?.exception"
                unelevated
                :label="$t('common.close')"
                color="primary"
                @click="decline()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { event as gtagEvent } from 'vue-gtag'
import { RelayedRequest, RelayedResponse } from './models'
import { blake2b256 } from 'thor-devkit'
import Summary from './Summary.vue'
import DelayRender from 'components/DelayRender'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'src/components/PageContent.vue'
import PageAction from 'src/components/PageAction.vue'

const ACCEPTED_SUFFIX = '.accepted'
const RESP_SUFFIX = '.resp'

export default defineComponent({
    components: { TxSummary: Summary, DelayRender, PageToolbar, PageContent, PageAction },
    props: {
        src: String, // the url to fetch request object
        close: String // '1': opened in a window of its own by a dApp (connect.js), closed when done
    },
    data: () => {
        return {
            responded: false,
            // async computed (see src/shims-async-computed.d.ts)
            request: null as RelayedRequest | null
        }
    },
    computed: {
        urlObject(): URL | null {
            try {
                const obj = new URL(this.src || '')
                if (['http:', 'https:'].includes(obj.protocol)) {
                    return obj
                }
                return null
            } catch (err) {
                console.warn(err)
                return null
            }
        }
    },
    asyncComputed: {
        async request(): Promise<RelayedRequest | null> {
            const urlObject = this.urlObject
            if (!urlObject) {
                throw new Error(this.$t('sign.msg_invalid_request').toString())
            }

            const rid = urlObject.pathname.split('/').pop() || ''
            if (!/^[0-9a-f]{64}$/i.test(rid)) {
                throw new Error(this.$t('sign.msg_invalid_request').toString())
            }

            const resp = await (async () => {
                for (let i = 0; i < 3; i++) {
                    try {
                        const resp = await this.$axios.get(
                            `${this.src}?wait=1`,
                            { transformResponse: data => data } // raw data is needed to verify hash
                        )
                        if (resp.data) {
                            return resp
                        }
                    } catch {
                        await new Promise(resolve => setTimeout(resolve, 2000))
                    }
                }
                throw new Error(this.$t('sign.msg_fetch_request_failed').toString())
            })()

            // Sync2's relay names a request by its blake2b-256, connect.js by its sha-256
            const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(resp.data))).toString('hex')
            if (blake2b256(resp.data).toString('hex') !== rid.toLowerCase() && sha256 !== rid.toLowerCase()) {
                throw new Error(this.$t('sign.msg_request_hash_mismatch').toString())
            }
            const request = RelayedRequest.validate(JSON.parse(resp.data))
            request.origin = resp.headers['x-data-origin']
            gtagEvent('connex-sign', { event_label: request.origin })
            this.postStatus(ACCEPTED_SUFFIX, {})
            // TODO validate body
            return request
        }
    },
    methods: {
        async signRequest() {
            const request = this.request
            if (!request) {
                return
            }
            const { gid } = request
            const wallets = await this.$svc.wallet.getByGid(gid)

            // if no suitable wallet, ask to create one
            if (wallets.length === 0) {
                try {
                    await this.$dialog({
                        title: this.$t('sign.title_ask_create_wallet').toString(),
                        message: this.$t('sign.message_ask_create_wallet').toString(),
                        ok: {
                            label: this.$t('common.ok'),
                            unelevated: true,
                            color: 'primary'
                        },
                        cancel: this.$t('common.cancel').toString()
                    })
                    this.$router.push({
                        name: 'new-wallet',
                        query: { defaultGid: gid }
                    })
                } catch { }
                return
            }

            let result = null
            if (request.type === 'tx') {
                const { payload } = request
                result = await this.$signTx(gid, {
                    message: payload.message,
                    options: payload.options,
                    origin: request.origin
                })
            } else if (request.type === 'cert') {
                let host
                try {
                    host = new URL(request.origin!).host
                } catch {
                }
                const { payload } = request
                result = await this.$signCert(gid, {
                    message: payload.message,
                    options: payload.options,
                    origin: request.origin,
                    domain: host || ''
                })
            }
            await this.respond({ payload: result! })
            this.$router.replace({ name: 'sign-success', query: { type: request.type, ...(this.close ? { close: this.close } : {}) } })
        },
        async decline() {
            if (this.close) {
                await this.respond()
                window.close()
            } else {
                this.$backOrHome()
            }
        },
        /** the window is closed before an answer: tell the dApp, which is waiting */
        onPageHide() {
            if (!this.responded && this.urlObject) {
                this.responded = true
                navigator.sendBeacon(`${this.src}${RESP_SUFFIX}`, JSON.stringify({ error: 'user decline' }))
            }
        },
        async postStatus(suffix: string, result: object) {
            for (let i = 0; i < 3; i++) {
                try {
                    await this.$axios.post(`${this.src}${suffix}`, result)
                    return
                } catch (err) {
                    console.warn(err)
                    await new Promise(resolve => setTimeout(resolve, 2 * 1000))
                }
            }
        },
        async respond(resp?: RelayedResponse) {
            if (!this.responded) {
                this.responded = true
                await this.postStatus(RESP_SUFFIX, resp || {
                    error: 'user decline'
                })
            }
        }
    },
    mounted() {
        window.addEventListener('pagehide', this.onPageHide)
    },
    beforeUnmount() {
        window.removeEventListener('pagehide', this.onPageHide)
        void this.respond()
    }
})
</script>
