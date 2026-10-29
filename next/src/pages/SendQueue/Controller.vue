<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('queue.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('queue.msg_intro')}}</p>
            <empty-state
                v-if="!groups.length"
                icon="o_playlist_add"
                :text="$t('queue.msg_empty')"
                :action="$t('send.action_send')"
                action-icon="o_north_east"
                @action="$router.push({ name: 'send', query: { wid, i } })"
            />
            <div
                v-for="g in groups"
                :key="g.key"
                class="q-mb-lg"
            >
                <div class="row items-center no-wrap q-pb-sm">
                    <div class="bvm-label col ellipsis">{{$t('queue.label_from', { name: g.name })}}</div>
                    <div class="text-caption text-muted">{{g.items.length}} / {{MAX_QUEUE}}</div>
                </div>
                <q-list
                    role="list"
                    class="bvm-list"
                >
                    <q-item
                        v-for="p in g.items"
                        :key="p.id"
                    >
                        <q-item-section avatar>
                            <address-avatar :addr="p.to" />
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label class="ellipsis">{{nameOf(p.to) || short(p.to)}}</q-item-label>
                            <q-item-label caption>{{fmt(p.amount)}} {{p.symbol}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-btn
                                flat
                                round
                                dense
                                icon="o_close"
                                :aria-label="$t('queue.action_remove')"
                                @click="dequeue([p.id])"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <div class="bvm-tile q-pa-md q-mt-sm">
                    <div class="text-caption text-muted">{{$t('queue.label_total')}}</div>
                    <div
                        v-for="(v, sym) in queueTotals(g.items)"
                        :key="sym"
                        class="bvm-amount total"
                    >{{v}} {{sym}}</div>
                    <div class="text-caption text-muted q-mt-xs">{{$t('queue.msg_one_tx', { n: g.items.length })}}</div>
                </div>
                <div class="row q-gutter-sm q-mt-sm">
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        class="col"
                        icon="o_north_east"
                        :label="$t('queue.action_send_all', { n: g.items.length })"
                        :disable="!g.canSign"
                        @click="sendAll(g)"
                    />
                    <q-btn
                        flat
                        no-caps
                        color="negative"
                        :label="$t('queue.action_clear')"
                        @click="dequeue(g.items.map(p => p.id))"
                    />
                </div>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import AddressAvatar from 'components/AddressAvatar.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { dequeue, MAX_QUEUE, queueClauses, queueTotals, sendQueue, type QueuedPayment } from 'src/utils/send-queue'
import { rememberPayment } from 'src/utils/last-payments'
import { nameOf } from 'src/utils/names'
import { BigNumber } from 'bignumber.js'
import { canSign } from 'src/utils/watch'

type Group = { key: string, gid: string, from: string, name: string, canSign: boolean, items: QueuedPayment[] }

// payments put aside on the send page, sent together in one transaction per address
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressAvatar },
    props: {
        wid: { type: String, default: '' },
        i: { type: String, default: '0' }
    },
    data: () => ({
        MAX_QUEUE,
        wallets: [] as M.Wallet[]
    }),
    computed: {
        groups(): Group[] {
            const by = new Map<string, Group>()
            for (const p of sendQueue.items) {
                const key = `${p.gid}:${p.from}`
                let g = by.get(key)
                if (!g) {
                    const w = this.wallets.find(x => x.gid === p.gid && x.meta.addresses.some(a => a.toLowerCase() === p.from))
                    const index = w ? w.meta.addresses.findIndex(a => a.toLowerCase() === p.from) : -1
                    g = { key, gid: p.gid, from: p.from, name: w ? `${w.meta.name} #${index + 1}` : this.short(p.from), canSign: !!w && canSign(w), items: [] }
                    by.set(key, g)
                }
                g.items.push(p)
            }
            return [...by.values()]
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
    },
    methods: {
        nameOf,
        queueTotals,
        fmt(amount: string) {
            return new BigNumber(amount).toFormat()
        },
        dequeue,
        short(a: string) {
            return `${a.slice(0, 8)}…${a.slice(-6)}`
        },
        async sendAll(g: Group) {
            const items = [...g.items]
            const comment = this.$t('queue.comment', { n: items.length })
            try {
                await this.$signTx(g.gid, {
                    message: queueClauses(items),
                    options: { signer: g.from, comment }
                })
            } catch {
                return
            }
            for (const p of items) rememberPayment(p.to, p.amount, p.symbol)
            dequeue(items.map(p => p.id))
            this.$dialog({
                component: SuccessDialog,
                title: this.$t('send.title_sent'),
                message: this.$t('queue.msg_sent', { n: items.length })
            }).catch(() => { })
        }
    }
})
</script>
<style lang="sass" scoped>
.total
  font-size: 18px
</style>
