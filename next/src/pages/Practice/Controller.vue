<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('practice.title')" />
        <page-content
            class="col"
            padding
        >
            <div class="bvm-tile q-pa-md q-mb-md row no-wrap items-start">
                <q-icon
                    name="o_school"
                    size="28px"
                    color="primary"
                />
                <p class="q-ml-md q-mb-none text-soft">{{$t('practice.msg_intro')}}</p>
            </div>
            <div class="row items-center q-mb-sm">
                <div class="bvm-label">{{$t('practice.label_steps')}}</div>
                <q-space />
                <span class="text-muted">{{done}}/{{steps.length}}</span>
            </div>
            <q-list
                role="list"
                class="bvm-list"
            >
                <q-item
                    v-for="(s, i) in steps"
                    :key="s.key"
                >
                    <q-item-section
                        avatar
                        top
                    >
                        <q-icon
                            :name="s.done ? 'check_circle' : 'radio_button_unchecked'"
                            :color="s.done ? 'primary' : 'grey-6'"
                            size="26px"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label class="text-weight-bold">{{i + 1}}. {{$t(`practice.step_${s.key}`)}}</q-item-label>
                        <q-item-label caption>{{$t(`practice.how_${s.key}`)}}</q-item-label>
                        <div
                            v-if="s.action && !s.done"
                            class="q-mt-sm"
                        >
                            <q-btn
                                outline
                                dense
                                no-caps
                                color="primary"
                                class="q-px-sm"
                                :label="$t(`practice.action_${s.key}`)"
                                @click="s.action()"
                            />
                        </div>
                    </q-item-section>
                </q-item>
            </q-list>
            <p class="text-caption text-muted q-mt-md">{{$t('practice.msg_note')}}</p>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import { genesises } from 'src/consts'
import { copyText } from 'src/utils/clipboard'
import { openURL } from 'src/utils/open-url'
import { selection } from 'src/utils/selection'

const FAUCET = 'https://faucet.vecha.in'

type Step = { key: 'wallet' | 'faucet' | 'send' | 'check', done: boolean, action?: () => void }

// practice with test money on VeChain's testnet: a wallet, free test VET, a first transfer
export default defineComponent({
    components: { PageToolbar, PageContent },
    data: () => ({
        wallets: [] as M.Wallet[],
        balance: 0n,
        sent: 0
    }),
    computed: {
        testWallet(): M.Wallet | null {
            return this.wallets.find(w => w.gid === genesises.test.id) || null
        },
        steps(): Step[] {
            const w = this.testWallet
            return [
                { key: 'wallet', done: !!w, action: () => void this.$router.push({ name: 'new-wallet', query: { defaultGid: genesises.test.id } }) },
                { key: 'faucet', done: this.balance > 0n, action: () => void this.faucet() },
                { key: 'send', done: this.sent > 0, action: w ? () => this.open(w, 'send') : undefined },
                { key: 'check', done: this.sent > 0 && this.balance > 0n, action: w ? () => this.open(w, 'activities') : undefined }
            ]
        },
        done(): number {
            return this.steps.filter(s => s.done).length
        }
    },
    async activated() {
        await this.load()
    },
    async created() {
        await this.load()
    },
    methods: {
        async load() {
            this.wallets = await this.$svc.wallet.all()
            const w = this.testWallet
            if (!w) return
            const address = w.meta.addresses[0]!
            try {
                const acc = await this.$svc.bc(w.gid).thor.account(address).get()
                this.balance = BigInt(acc.balance)
            } catch { }
            const activity = await this.$svc.activity.page(500, 0)
            this.sent = activity.filter(a => a.gid === w.gid && a.type === 'tx').length
        },
        async faucet() {
            const w = this.testWallet
            if (!w) return
            // the faucet asks for the address: it's on the clipboard
            await copyText(w.meta.addresses[0]!).catch(() => { })
            this.$q.notify(this.$t('practice.msg_copied'))
            openURL(FAUCET)
        },
        open(w: M.Wallet, page: 'send' | 'activities') {
            selection.walletId = w.id
            void this.$router.push(page === 'send' ? { name: 'send' } : { name: 'activities' })
        }
    }
})
</script>
