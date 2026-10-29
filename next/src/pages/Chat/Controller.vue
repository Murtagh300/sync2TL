<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="peer ? peerName : $t('chat.title')" />
        <page-content
            ref="scroller"
            class="col"
            padding
        >
            <empty-state
                v-if="!available"
                icon="o_forum"
                :text="$t('chat.msg_no_server')"
            />
            <template v-else>
                <q-select
                    v-if="addresses.length > 1 && !peer"
                    v-model="me"
                    :options="addresses"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('chat.label_as')"
                    class="q-mb-md"
                />

                <!-- chat not on for this address yet -->
                <div
                    v-if="!enabled"
                    class="bvm-tile q-pa-md text-center"
                >
                    <q-icon
                        name="o_lock"
                        size="36px"
                        color="primary"
                    />
                    <div class="text-weight-bold q-mt-sm">{{$t('chat.title_enable')}}</div>
                    <p class="text-soft q-mt-xs">{{$t('chat.msg_enable')}}</p>
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        :loading="working"
                        :disable="!canSignMe"
                        :label="$t('chat.action_enable')"
                        @click="enable()"
                    />
                </div>

                <!-- one conversation -->
                <template v-else-if="peer">
                    <div
                        v-if="!thread.length && !loading"
                        class="text-center text-muted q-py-xl"
                    >{{$t('chat.msg_empty_thread')}}</div>
                    <div
                        v-for="l in thread"
                        :key="l.id"
                        class="row q-mb-sm"
                        :class="l.from === meLower ? 'justify-end' : 'justify-start'"
                    >
                        <div
                            class="bubble"
                            :class="l.from === meLower ? 'bubble--mine' : 'bubble--theirs'"
                        >
                            <div
                                v-if="l.text !== null"
                                class="bubble-text"
                            >{{l.text}}</div>
                            <div
                                v-else
                                class="bubble-text text-muted"
                            >{{$t('chat.msg_unreadable')}}</div>
                            <div class="bubble-time">{{time(l.at)}}</div>
                        </div>
                    </div>
                </template>

                <!-- the conversations -->
                <template v-else>
                    <q-input
                        v-model="newPeer"
                        outlined
                        dense
                        :placeholder="$t('chat.placeholder_new')"
                        :error="!!newError"
                        :error-message="newError"
                        class="q-mb-md"
                        @keyup.enter="openNew()"
                    >
                        <template #append>
                            <q-btn
                                flat
                                round
                                dense
                                icon="o_arrow_forward"
                                :aria-label="$t('chat.action_new')"
                                @click="openNew()"
                            />
                        </template>
                    </q-input>
                    <div
                        v-if="loading && !lines.length"
                        class="column q-gutter-y-sm"
                    >
                        <q-skeleton
                            v-for="i in 3"
                            :key="i"
                            height="56px"
                        />
                    </div>
                    <empty-state
                        v-else-if="!convos.length"
                        icon="o_forum"
                        :text="$t('chat.msg_none')"
                    />
                    <q-list
                        v-else
                        role="list"
                        class="bvm-list"
                    >
                        <q-item
                            v-for="c in convos"
                            :key="c.with"
                            clickable
                            @click="open(c.with)"
                        >
                            <q-item-section>
                                <q-item-label class="text-weight-bold ellipsis"><address-label :addr="c.with" /></q-item-label>
                                <q-item-label
                                    caption
                                    lines="1"
                                >{{c.last.from === meLower ? $t('chat.label_you') : ''}}{{c.last.text ?? $t('chat.msg_unreadable')}}</q-item-label>
                            </q-item-section>
                            <q-item-section side>
                                <div class="text-caption text-muted">{{time(c.last.at)}}</div>
                                <q-badge
                                    v-if="c.unread"
                                    color="primary"
                                    text-color="dark"
                                    rounded
                                >{{c.unread}}</q-badge>
                            </q-item-section>
                        </q-item>
                    </q-list>
                    <p class="text-caption text-muted q-mt-md">{{$t('chat.msg_how')}}</p>
                </template>
            </template>
        </page-content>
        <page-action v-if="available && enabled && peer">
            <q-input
                v-model="draft"
                outlined
                dense
                autogrow
                :maxlength="MAX_CHAT"
                :placeholder="$t('chat.placeholder_message')"
                :error="!!sendError"
                :error-message="sendError"
                class="full-width"
                @keydown.enter.exact.prevent="send()"
            >
                <template #append>
                    <q-btn
                        flat
                        round
                        dense
                        icon="o_send"
                        color="primary"
                        :loading="sending"
                        :disable="!draft.trim()"
                        :aria-label="$t('chat.action_send')"
                        @click="send()"
                    />
                </template>
            </q-input>
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address as addr } from 'thor-devkit'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import EmptyState from 'components/EmptyState.vue'
import AddressLabel from 'components/AddressLabel.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatDate } from 'src/utils/format'
import { isVetName, nameOf, resolveVetName } from 'src/utils/names'
import { chatAvailable, chatKeyOf, conversations, keepChatKey, keyCertContent, MAX_CHAT, newChatKey, publishKey, readChat, sendChat, type ChatLine, type Conversation } from 'src/utils/chat'

const SEEN = 'bv-chat-seen'
const isAddress = (v: string): boolean => addr.test(v)

function loadSeen(): Record<string, number> {
    try {
        return JSON.parse(localStorage.getItem(SEEN) || '{}') as Record<string, number>
    } catch {
        return {}
    }
}

// encrypted messages between addresses: the conversations, and one of them
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, EmptyState, AddressLabel },
    props: {
        with: { type: String, default: '' }
    },
    data: () => ({
        MAX_CHAT,
        available: chatAvailable(),
        wallets: [] as M.Wallet[],
        me: '',
        lines: [] as ChatLine[],
        enabledFor: '' as string,
        loading: false,
        working: false,
        draft: '',
        sending: false,
        sendError: '',
        newPeer: '',
        newError: '',
        seen: loadSeen(),
        poll: null as ReturnType<typeof setInterval> | null
    }),
    computed: {
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id && canSign(w))
                .flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        meLower(): string {
            return this.me.toLowerCase()
        },
        canSignMe(): boolean {
            return this.addresses.some(a => a.value === this.me)
        },
        enabled(): boolean {
            return !!this.me && this.enabledFor === this.meLower
        },
        peer(): string {
            return isAddress(this.with) ? this.with.toLowerCase() : ''
        },
        convos(): Conversation[] {
            return conversations(this.lines, this.me, this.seen)
        },
        /** a contact's name, the .vet name, or the short address */
        peerName(): string {
            return nameOf(this.peer) || `${this.peer.slice(0, 6)}…${this.peer.slice(-4)}`
        },
        thread(): ChatLine[] {
            return this.lines.filter(l => l.from === this.peer || l.to === this.peer)
        }
    },
    watch: {
        me() { this.check() },
        with() { this.markSeen(); this.scrollDown() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id && canSign(x)))
        this.me = w?.meta.addresses[0] || this.addresses[0]?.value || ''
        this.poll = setInterval(() => void this.load(true), 8000)
    },
    beforeUnmount() {
        this.poll && clearInterval(this.poll)
    },
    methods: {
        time(at: number) {
            return formatDate(at, { relative: true })
        },
        check() {
            this.lines = []
            this.enabledFor = chatKeyOf(this.me) ? this.meLower : ''
            if (this.enabledFor) void this.load()
        },
        async load(quiet = false) {
            if (!this.enabled || !this.available) return
            if (!quiet) this.loading = true
            try {
                const since = this.lines.length ? this.lines[this.lines.length - 1]!.id : 0
                const fresh = await readChat(this.me, since)
                if (fresh.length) {
                    const ids = new Set(this.lines.map(l => l.id))
                    this.lines = [...this.lines, ...fresh.filter(l => !ids.has(l.id))].sort((a, b) => a.id - b.id)
                    this.markSeen()
                    this.scrollDown()
                }
            } catch (err) {
                if (!quiet) console.warn('chat:', err)
            } finally {
                this.loading = false
            }
        },
        async enable() {
            if (!this.canSignMe) return
            const { priv, pub } = newChatKey()
            const message = { purpose: 'identification' as const, payload: { type: 'text' as const, content: keyCertContent(pub) } }
            this.working = true
            let resp: M.CertResponse
            try {
                resp = await this.$signCert(genesises.main.id, { message, options: { signer: this.me }, domain: window.location.host, origin: window.location.origin })
            } catch {
                // declined
                this.working = false
                return
            }
            try {
                await publishKey({ ...message, ...resp.annex, signature: resp.signature })
                keepChatKey(this.me, priv)
                this.enabledFor = this.meLower
                void this.load()
            } catch (err) {
                console.warn('chat key:', err)
                this.$q.notify({ message: this.$t('chat.msg_enable_failed'), color: 'negative' })
            } finally {
                this.working = false
            }
        },
        async openNew() {
            this.newError = ''
            let a = this.newPeer.trim()
            if (isVetName(a)) a = (await resolveVetName(a).catch(() => null)) || ''
            if (!isAddress(a)) {
                this.newError = this.$t('send.msg_invalid_address')
                return
            }
            if (a.toLowerCase() === this.meLower) {
                this.newError = this.$t('chat.msg_self')
                return
            }
            this.newPeer = ''
            this.open(a)
        },
        open(a: string) {
            void this.$router.push({ name: 'chat', query: { with: a.toLowerCase() } })
        },
        markSeen() {
            const p = this.peer
            if (!p) return
            const last = this.thread[this.thread.length - 1]
            if (!last || (this.seen[p] || 0) >= last.id) return
            this.seen = { ...this.seen, [p]: last.id }
            try {
                localStorage.setItem(SEEN, JSON.stringify(this.seen))
            } catch { }
        },
        scrollDown() {
            void this.$nextTick(() => {
                const el = (this.$refs.scroller as { $el?: HTMLElement } | undefined)?.$el
                el?.scrollTo?.({ top: el.scrollHeight })
            })
        },
        async send() {
            const text = this.draft.trim()
            if (!text || !this.peer || this.sending) return
            this.sending = true
            this.sendError = ''
            try {
                const ok = await sendChat(this.me, this.peer, text)
                if (!ok) {
                    this.sendError = this.$t('chat.msg_peer_not_on')
                    return
                }
                this.draft = ''
                await this.load(true)
            } catch (err) {
                console.warn('chat send:', err)
                this.sendError = this.$t('common.something_wrong')
            } finally {
                this.sending = false
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.bubble
  max-width: 78%
  padding: 8px 12px
  border-radius: 16px
  word-break: break-word
  white-space: pre-wrap

.bubble--mine
  background: var(--q-primary)
  color: #0b0b0c
  border-bottom-right-radius: 4px

.bubble--theirs
  background: rgba(255, 255, 255, 0.07)
  border-bottom-left-radius: 4px

.bubble-time
  font-size: 11px
  opacity: 0.65
  margin-top: 2px
  text-align: right
</style>
