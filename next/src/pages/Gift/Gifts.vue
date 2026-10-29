<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('gift.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('gift.msg_intro')}}</p>

            <!-- a new link -->
            <div class="bvm-tile q-pa-md q-mb-lg">
                <q-select
                    v-if="addresses.length > 1"
                    v-model="from"
                    :options="addresses"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('gift.label_from')"
                    class="q-mb-md"
                />
                <div class="row q-gutter-sm q-mb-md">
                    <q-chip
                        v-for="s in symbols"
                        :key="s"
                        clickable
                        :outline="s !== symbol"
                        :color="s === symbol ? 'primary' : undefined"
                        :text-color="s === symbol ? 'dark' : undefined"
                        @click="symbol = s"
                    >{{s}}</q-chip>
                </div>
                <q-input
                    v-model="amount"
                    outlined
                    dense
                    inputmode="decimal"
                    :label="$t('gift.label_amount', { symbol })"
                    :error="!!amountError"
                    :error-message="amountError"
                />
                <q-input
                    v-model="note"
                    outlined
                    dense
                    maxlength="80"
                    :label="$t('gift.label_note')"
                    class="q-mt-sm"
                />
                <p class="text-caption text-muted q-mt-sm">{{$t('gift.msg_vtho')}}</p>
                <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    icon="o_link"
                    class="full-width"
                    :disable="!wei || !from"
                    :loading="working"
                    :label="$t('gift.action_create')"
                    @click="create()"
                />
            </div>

            <!-- the links made on this device -->
            <div
                v-if="list.length"
                class="text-weight-bold q-mb-sm"
            >{{$t('gift.label_made')}}</div>
            <q-list
                v-if="list.length"
                class="bvm-list"
            >
                <q-item
                    v-for="g in list"
                    :key="g.id"
                >
                    <q-item-section>
                        <q-item-label class="text-weight-bold">{{g.amount}} {{g.symbol}}</q-item-label>
                        <q-item-label caption>{{g.note || dateText(g.createdAt)}}</q-item-label>
                        <q-item-label caption>{{stateText(g)}}</q-item-label>
                    </q-item-section>
                    <q-item-section
                        v-if="state[g.id] === 'open'"
                        side
                    >
                        <div class="row no-wrap">
                            <q-btn
                                flat
                                round
                                dense
                                icon="o_share"
                                :aria-label="$t('gift.action_share')"
                                @click="show(g)"
                            />
                            <q-btn
                                flat
                                round
                                dense
                                icon="o_undo"
                                :aria-label="$t('gift.action_reclaim')"
                                @click="reclaim(g)"
                            />
                        </div>
                    </q-item-section>
                </q-item>
            </q-list>
        </page-content>

        <!-- the link, to share -->
        <q-dialog
            v-model="showing"
            :position="$q.screen.xs ? 'bottom' : 'standard'"
        >
            <q-card
                v-if="shown"
                class="full-width link-card"
            >
                <q-card-section class="column items-center text-center">
                    <div class="bvm-display link-title">{{shown.amount}} {{shown.symbol}}</div>
                    <p class="text-soft q-mt-sm">{{$t('gift.msg_share')}}</p>
                    <div class="qr bvm-tile">
                        <q-r-code :key="shownLink">{{shownLink}}</q-r-code>
                    </div>
                </q-card-section>
                <q-card-actions class="column q-gutter-y-sm q-px-md q-pb-md">
                    <q-btn
                        v-if="canShare"
                        unelevated
                        no-caps
                        color="primary"
                        icon="o_share"
                        class="full-width"
                        :label="$t('gift.action_share')"
                        @click="share()"
                    />
                    <q-btn
                        outline
                        no-caps
                        color="primary"
                        icon="o_content_copy"
                        class="full-width"
                        :label="$t('gift.action_copy')"
                        @click="copy()"
                    />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import QRCode from 'components/QRCode.vue'
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatDate } from 'src/utils/format'
import { copyText } from 'src/utils/clipboard'
import { giftClauses, giftId, giftLink, gifts, newGiftKey, type Gift } from 'src/utils/gift'

type State = 'open' | 'claimed' | 'reclaimed' | 'pending'

// money links: crypto for someone without a wallet, through a link they open
export default defineComponent({
    components: { PageToolbar, PageContent, QRCode },
    data: () => ({
        wallets: [] as M.Wallet[],
        tokens: [] as M.TokenSpec[],
        from: '',
        symbol: 'VET',
        amount: '',
        note: '',
        working: false,
        state: {} as Record<string, State>,
        showing: false,
        shown: null as Gift | null,
        canShare: typeof navigator !== 'undefined' && !!navigator.share
    }),
    computed: {
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id && canSign(w))
                .flatMap(w => w.meta.addresses.map((a, i) => ({ label: `${w.meta.name} #${i + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        symbols(): string[] {
            return ['VET', 'B3TR', 'VTHO'].filter(s => s === 'VET' || this.tokens.some(t => t.symbol === s))
        },
        spec(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.symbol)
        },
        vtho(): string {
            return this.tokens.find(t => t.symbol === 'VTHO')?.address || ''
        },
        wei(): bigint {
            const v = new BigNumber(this.amount.replace(',', '.'))
            if (!v.isFinite() || v.lte(0)) return 0n
            return BigInt(v.times(new BigNumber(10).pow(this.spec?.decimals ?? 18)).integerValue(BigNumber.ROUND_DOWN).toFixed(0))
        },
        amountError(): string {
            return this.amount && !this.wei ? this.$t('send.msg_invalid_amount') : ''
        },
        list(): Gift[] {
            return [...gifts.list].sort((a, b) => b.createdAt - a.createdAt)
        },
        shownLink(): string {
            return this.shown ? giftLink(this.shown.key, this.shown.note) : ''
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id && canSign(x)))
        this.from = w?.meta.addresses[0] || this.addresses[0]?.value || ''
        this.tokens = (await this.$svc.config.token.all()).filter(t => t.gid === genesises.main.id)
        await this.check()
    },
    methods: {
        dateText(t: number) {
            return formatDate(t, { relative: true })
        },
        stateText(g: Gift): string {
            const s = this.state[g.id]
            return s ? this.$t(`gift.state_${s}`) : ''
        },
        /** open while the link's address still holds what was sent */
        async check() {
            const bc = this.$svc.bc(genesises.main.id)
            for (const g of gifts.list) {
                if (g.reclaimed) {
                    this.state[g.id] = 'reclaimed'
                    continue
                }
                try {
                    const spec = this.tokens.find(t => t.symbol === g.symbol)
                    const bal = spec ? await bc.balanceOf(g.address, spec) : '0'
                    this.state[g.id] = new BigNumber(bal).gt(0) ? 'open' : g.txId ? 'claimed' : 'pending'
                } catch { }
            }
        },
        async create() {
            const wei = this.wei
            if (!wei || !this.from || !this.vtho) return
            const { key, address } = newGiftKey()
            const g: Gift = {
                id: giftId(),
                key,
                address,
                amount: new BigNumber(this.amount.replace(',', '.')).toFixed(),
                symbol: this.symbol,
                token: this.symbol === 'VET' ? '' : this.spec?.address || '',
                decimals: this.spec?.decimals ?? 18,
                note: this.note.trim(),
                createdAt: Date.now(),
                from: this.from
            }
            // kept before anything is sent: the money is never in a place only the chain knows
            gifts.list = [g, ...gifts.list]
            this.working = true
            try {
                const comment = this.$t('gift.comment')
                const resp = await this.$signTx(genesises.main.id, {
                    message: giftClauses(address, wei, g.token, this.vtho).map(c => ({ ...c, comment })),
                    options: { signer: this.from, comment }
                })
                const saved = gifts.list.find(x => x.id === g.id)
                if (saved) saved.txId = resp.txid
                this.state[g.id] = 'open'
                this.amount = ''
                this.note = ''
                this.show(saved || g)
            } catch {
                // declined: no link
                gifts.list = gifts.list.filter(x => x.id !== g.id)
            } finally {
                this.working = false
            }
        },
        show(g: Gift) {
            this.shown = g
            this.showing = true
        },
        async share() {
            const g = this.shown
            if (!g) return
            try {
                await navigator.share({ title: this.$t('gift.share_title', { amount: `${g.amount} ${g.symbol}` }), text: g.note || this.$t('gift.share_text'), url: this.shownLink })
            } catch { }
        },
        async copy() {
            await copyText(this.shownLink)
            this.$q.notify(this.$t('common.copied'))
        },
        reclaim(g: Gift) {
            void this.$router.push({ name: 'claim', query: { k: g.key } })
        }
    }
})
</script>
<style lang="sass" scoped>
.link-card
  max-width: 440px

.link-title
  font-size: 26px

.qr
  width: 240px
  max-width: 75vw
  padding: 12px
  background: #fff
  border-radius: 14px
</style>
