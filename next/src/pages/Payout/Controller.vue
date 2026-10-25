<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('payout.title')" />
        <page-content
            v-if="wallet"
            class="col"
            padding
        >
            <q-btn-toggle
                v-model="mode"
                spread
                no-caps
                unelevated
                toggle-color="primary"
                color="dark"
                class="q-mb-md mode"
                :options="[{ label: $t('payout.mode_tokens'), value: 'tokens' }, { label: $t('payout.mode_nfts'), value: 'nfts' }]"
            />
            <p class="text-soft">{{$t(mode === 'tokens' ? 'payout.msg_intro' : 'payout.msg_intro_nfts')}}</p>

            <q-select
                v-if="mode === 'tokens'"
                v-model="symbol"
                :options="tokens.map(t => t.symbol)"
                :label="$t('payout.label_token')"
                outlined
                dense
                class="q-mb-md"
            >
                <template #append>
                    <span
                        v-if="balance !== null"
                        class="text-caption text-muted"
                    >{{$t('swap.label_balance')}} {{formatUnits(balance, token?.decimals || 18)}}</span>
                </template>
            </q-select>
            <q-select
                v-else
                v-model="collectionSlug"
                :options="collections"
                option-value="slug"
                option-label="name"
                emit-value
                map-options
                :label="$t('payout.label_collection')"
                :loading="loadingNfts"
                outlined
                dense
                class="q-mb-md"
            >
                <template #append>
                    <span
                        v-if="collectionSlug"
                        class="text-caption text-muted"
                    >{{$t('payout.label_free_nfts', { n: freeNfts })}}</span>
                </template>
            </q-select>

            <q-input
                v-model="text"
                type="textarea"
                outlined
                autogrow
                input-class="payout-text"
                :label="$t('payout.label_list')"
                :placeholder="mode === 'tokens' ? placeholder : placeholderNfts"
                :hint="$t(mode === 'tokens' ? 'payout.hint_list' : 'payout.hint_list_nfts')"
            />
            <div class="row q-gutter-x-sm q-mt-sm">
                <q-btn
                    outline
                    no-caps
                    dense
                    class="q-px-sm"
                    color="primary"
                    icon="o_upload_file"
                    :label="$t('payout.action_load')"
                    @click="($refs.file as HTMLInputElement).click()"
                />
                <q-btn
                    v-if="text"
                    flat
                    no-caps
                    dense
                    class="q-px-sm"
                    :label="$t('payout.action_clear')"
                    @click="text = ''"
                />
                <input
                    ref="file"
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    class="hidden"
                    @change="loadFile"
                >
            </div>

            <!-- what is wrong, line by line -->
            <div
                v-if="errors.length || unresolved.length || missing.length"
                class="bvm-tile payout-errors q-mt-md"
                role="alert"
            >
                <div
                    v-for="e in errors.slice(0, 8)"
                    :key="'e' + e.line"
                >{{$t(e.key === 'address' ? 'payout.err_address' : mode === 'tokens' ? 'payout.err_amount' : 'payout.err_token_id', { line: e.line })}}</div>
                <div
                    v-for="r in unresolved"
                    :key="'u' + r.line"
                >{{$t('payout.err_name', { line: r.line, name: r.to })}}</div>
                <div
                    v-for="line in missing.slice(0, 8)"
                    :key="'m' + line"
                >{{$t('payout.err_no_nft', { line })}}</div>
                <div v-if="errors.length > 8">{{$t('payout.err_more', { n: errors.length - 8 })}}</div>
            </div>

            <!-- the review -->
            <template v-if="review.length">
                <div class="bvm-tile payout-summary q-mt-md">
                    <div class="row items-baseline">
                        <span class="text-muted">{{$t('payout.label_recipients', { n: review.length })}}</span>
                        <q-space />
                        <span
                            v-if="mode === 'tokens'"
                            class="bvm-amount payout-total"
                        >{{formatUnits(total, token?.decimals || 18)}} {{symbol}}</span>
                        <span
                            v-else
                            class="bvm-amount payout-total"
                        >{{$t('nft.label_count', { n: review.length })}}</span>
                    </div>
                    <div
                        v-if="batches > 1"
                        class="text-muted text-caption"
                    >{{$t('payout.msg_batches', { n: batches })}}</div>
                    <div
                        v-if="short"
                        class="text-negative text-caption"
                    >{{$t('swap.msg_insufficient', { symbol })}}</div>
                </div>
                <q-list class="bvm-list q-mt-sm">
                    <q-item
                        v-for="r in review.slice(0, shownRows)"
                        :key="r.line"
                        dense
                    >
                        <q-item-section>
                            <q-item-label class="ellipsis">
                                <address-label :addr="r.to" />
                            </q-item-label>
                            <q-item-label
                                v-if="r.note || dup.has(r.to.toLowerCase()) || lookalikes[r.to.toLowerCase()]"
                                caption
                            >
                                <span
                                    v-if="lookalikes[r.to.toLowerCase()]"
                                    class="text-negative text-weight-bold"
                                >{{$t('payout.label_lookalike')}} · </span>
                                <span
                                    v-if="dup.has(r.to.toLowerCase())"
                                    class="text-warning"
                                >{{$t('payout.label_duplicate')}} · </span>{{r.note}}
                            </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <span class="bvm-amount">{{r.what}}</span>
                        </q-item-section>
                    </q-item>
                </q-list>
                <q-btn
                    v-if="review.length > shownRows"
                    flat
                    no-caps
                    class="full-width q-mt-xs"
                    :label="$t('payout.action_show_all', { n: review.length })"
                    @click="shownRows = review.length"
                />
            </template>
            <empty-state
                v-else-if="!text.trim()"
                :icon="mode === 'tokens' ? 'o_groups' : 'o_collections'"
                :text="$t(mode === 'tokens' ? 'payout.msg_empty' : 'payout.msg_empty_nfts')"
            />
        </page-content>
        <page-action v-if="wallet">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_send"
                :loading="paying"
                :disable="!canPay"
                :label="progress || $t('payout.action_pay', { n: review.length })"
                @click="pay()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BigNumber } from 'bignumber.js'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import AddressLabel from 'components/AddressLabel.vue'
import EmptyState from 'components/EmptyState.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import { assignNfts, BATCH_SIZE, duplicates, parseNftPayout, parsePayout, payoutBatches, payoutTotal, type OwnedNft, type PayoutError, type PayoutRow } from 'src/utils/payout'
import { sendClauses } from 'src/utils/market'
import { isVetName, resolveVetName } from 'src/utils/names'
import { findLookalike } from 'src/utils/recipient'
import { visibleTokens } from 'src/utils/tokens'
import { selectedWallet } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatUnits } from 'src/utils/format'
import type { BVM } from 'boot/services/bvm'

type ReviewRow = { line: number, to: string, what: string, note: string, nft?: OwnedNft }

// pay a list of addresses in one go: tokens, or one NFT each (an airdrop)
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel, EmptyState },
    props: {
        wid: String,
        i: String
    },
    data: () => ({
        mode: 'tokens' as 'tokens' | 'nfts',
        wallets: [] as M.Wallet[],
        tokens: [] as M.TokenSpec[],
        symbol: 'VET',
        text: '',
        balance: null as bigint | null,
        collections: [] as BVM.OwnedCollection[],
        collectionSlug: '',
        owned: [] as OwnedNft[],
        loadingNfts: false,
        /** .vet names to their address ('' when they point nowhere) */
        names: {} as Record<string, string>,
        /** recipients that imitate an address you know */
        lookalikes: {} as Record<string, string>,
        shownRows: 30,
        paying: false,
        progress: ''
    }),
    computed: {
        wallet(): M.Wallet | null {
            const signable = this.wallets.filter(canSign)
            if (this.wid) {
                return signable.find(w => String(w.id) === this.wid) || null
            }
            return selectedWallet(signable)
        },
        address(): string {
            return this.wallet?.meta.addresses[parseInt(this.i || '0')] || ''
        },
        token(): M.TokenSpec | undefined {
            return this.tokens.find(t => t.symbol === this.symbol)
        },
        placeholder(): string {
            return '0x8b9b…a6f3, 25, Prize\nalice.vet, 10\n0x51a2…77c0; 12,5'
        },
        placeholderNfts(): string {
            return '0x8b9b…a6f3, 42\nalice.vet\n0x51a2…77c0'
        },
        tokenParsed() {
            return parsePayout(this.text)
        },
        nftParsed() {
            return parseNftPayout(this.text)
        },
        errors(): PayoutError[] {
            return this.mode === 'tokens' ? this.tokenParsed.errors : this.nftParsed.errors
        },
        /** lines with their .vet names resolved */
        lines(): { line: number, to: string }[] {
            return (this.mode === 'tokens' ? this.tokenParsed.rows : this.nftParsed.rows)
                .map(r => ({ line: r.line, to: isVetName(r.to) ? this.names[r.to.toLowerCase()] || '' : r.to }))
        },
        unresolved(): { line: number, to: string }[] {
            const rows = this.mode === 'tokens' ? this.tokenParsed.rows : this.nftParsed.rows
            return rows.filter(r => isVetName(r.to) && this.names[r.to.toLowerCase()] === '')
        },
        ready(): PayoutRow[] {
            const to = new Map(this.lines.map(l => [l.line, l.to]))
            return this.tokenParsed.rows.map(r => ({ ...r, to: to.get(r.line) || '' })).filter(r => !!r.to)
        },
        assigned() {
            const to = new Map(this.lines.map(l => [l.line, l.to]))
            const rows = this.nftParsed.rows.map(r => ({ ...r, to: to.get(r.line) || '' })).filter(r => !!r.to)
            return assignNfts(rows, this.owned)
        },
        missing(): number[] {
            return this.mode === 'nfts' && this.collectionSlug ? this.assigned.missing : []
        },
        review(): ReviewRow[] {
            if (this.mode === 'tokens') {
                return this.ready.map(r => ({ line: r.line, to: r.to, what: r.amount, note: r.note }))
            }
            return this.assigned.pairs.map(p => ({ line: p.row.line, to: p.row.to, what: `#${p.nft.tokenId}`, note: '', nft: p.nft }))
        },
        freeNfts(): number {
            return this.owned.filter(n => !n.listed).length
        },
        dup(): Set<string> {
            return duplicates(this.review.map(r => ({ line: r.line, to: r.to, amount: '0', note: '' })))
        },
        total(): bigint {
            return this.token ? payoutTotal(this.ready, this.token.decimals) : 0n
        },
        short(): boolean {
            return this.mode === 'tokens' && this.balance !== null && this.total > this.balance
        },
        batches(): number {
            return Math.ceil(this.review.length / BATCH_SIZE)
        },
        canPay(): boolean {
            const parsedCount = this.mode === 'tokens' ? this.tokenParsed.rows.length : this.nftParsed.rows.length
            return !this.paying && this.review.length > 0 && !this.errors.length && !this.unresolved.length &&
                !this.missing.length && this.review.length === parsedCount && !this.short &&
                (this.mode === 'tokens' ? !!this.token : !!this.collectionSlug)
        }
    },
    watch: {
        symbol() { void this.loadBalance() },
        address() { void this.loadBalance() },
        text() { void this.resolve() },
        mode(m: string) {
            if (m === 'nfts' && !this.collections.length) void this.loadCollections()
        },
        collectionSlug() { void this.loadOwned() }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = this.wallet
        if (w && this.address) {
            this.tokens = await visibleTokens(this.$svc, w.gid, this.address)
            void this.loadBalance()
        }
    },
    methods: {
        formatUnits,
        async loadBalance() {
            const w = this.wallet
            const t = this.token
            this.balance = null
            if (!w || !t || !this.address) {
                return
            }
            try {
                const b = await this.$svc.bc(w.gid).balanceOf(this.address, t)
                this.balance = BigInt(new BigNumber(b).toFixed(0))
            } catch { }
        },
        async loadCollections() {
            if (!this.address) return
            this.loadingNfts = true
            try {
                const h = await this.$svc.bvm.holdings(this.address, { limit: 1 })
                this.collections = h.ownedCollections || []
            } catch {
                this.$q.notify({ message: this.$t('nft.msg_unreachable'), color: 'negative' })
            } finally {
                this.loadingNfts = false
            }
        },
        /** every NFT of the chosen collection on this address */
        async loadOwned() {
            this.owned = []
            if (!this.collectionSlug || !this.address) return
            this.loadingNfts = true
            try {
                const all: OwnedNft[] = []
                for (let offset = 0; offset < 2000;) {
                    const h = await this.$svc.bvm.holdings(this.address, { collection: this.collectionSlug, limit: 100, offset })
                    all.push(...h.holdings.map(n => ({ contract: n.contract, tokenId: n.tokenId, listed: n.listed, tokenStandard: n.tokenStandard })))
                    if (!h.pagination.hasMore) break
                    offset = h.pagination.nextOffset
                }
                this.owned = all
            } catch {
                this.$q.notify({ message: this.$t('nft.msg_unreachable'), color: 'negative' })
            } finally {
                this.loadingNfts = false
            }
        },
        loadFile(e: Event) {
            const input = e.target as HTMLInputElement
            const file = input.files?.[0]
            input.value = ''
            if (!file) {
                return
            }
            if (file.size > 512 * 1024) {
                this.$q.notify({ message: this.$t('payout.err_file'), color: 'negative' })
                return
            }
            void file.text().then(t => { this.text = t })
        },
        /** resolve .vet names and look for look-alike addresses */
        async resolve() {
            const w = this.wallet
            if (!w) {
                return
            }
            const rows = this.mode === 'tokens' ? this.tokenParsed.rows : this.nftParsed.rows
            for (const r of rows) {
                const key = r.to.toLowerCase()
                if (isVetName(r.to) && !(key in this.names)) {
                    this.names = { ...this.names, [key]: (await resolveVetName(r.to).catch(() => null)) || '' }
                }
            }
            const found: Record<string, string> = {}
            for (const l of this.lines.filter(l => !!l.to)) {
                const imitates = await findLookalike(this.$svc, w.gid, l.to)
                if (imitates) found[l.to.toLowerCase()] = imitates
            }
            this.lookalikes = found
        },
        async pay() {
            const w = this.wallet
            if (!w || !this.canPay) {
                return
            }
            if (Object.keys(this.lookalikes).length) {
                const go = await new Promise<boolean>(resolve => {
                    this.$q.dialog({
                        title: this.$t('recipientCheck.title_lookalike'),
                        message: this.$t('payout.msg_lookalikes', { n: Object.keys(this.lookalikes).length }),
                        cancel: true,
                        ok: { label: this.$t('recipientCheck.action_continue_anyway'), color: 'negative', flat: true }
                    }).onOk(() => resolve(true)).onCancel(() => resolve(false)).onDismiss(() => resolve(false))
                })
                if (!go) {
                    return
                }
            }
            let batches: { to: string, value: string, data: string, comment: string }[][]
            let label: string
            if (this.mode === 'tokens') {
                const t = this.token!
                batches = payoutBatches(this.ready, { address: t.address, decimals: t.decimals, symbol: t.symbol })
                label = t.symbol
            } else {
                const name = this.collections.find(c => c.slug === this.collectionSlug)?.name || 'NFT'
                const clauses = this.review.map(r => ({ ...sendClauses([r.nft!], this.address, r.to)[0]!, comment: `${name} #${r.nft!.tokenId}` }))
                batches = []
                for (let i = 0; i < clauses.length; i += BATCH_SIZE) batches.push(clauses.slice(i, i + BATCH_SIZE))
                label = name
            }
            this.paying = true
            let sent = 0
            try {
                for (const [n, batch] of batches.entries()) {
                    this.progress = batches.length > 1 ? this.$t('payout.label_batch', { n: n + 1, of: batches.length }) : ''
                    const comment = this.$t('payout.comment', { n: batch.length, symbol: label })
                    await this.$signTx(w.gid, { message: batch, options: { signer: this.address, comment } })
                    sent += batch.length
                }
            } catch {
                // declined: the batches signed so far are on their way
            } finally {
                this.paying = false
                this.progress = ''
            }
            if (sent) {
                this.$dialog({
                    component: SuccessDialog,
                    title: this.$t('payout.title_done'),
                    message: this.$t('payout.msg_done', { n: sent, of: this.review.length })
                }).catch(() => { })
                if (sent === this.review.length) {
                    this.text = ''
                    if (this.mode === 'nfts') void this.loadOwned()
                }
            }
        }
    }
})
</script>
<style lang="sass" scoped>
:deep(.payout-text)
  font-variant-numeric: tabular-nums
  font-size: 13px
  min-height: 120px

.mode
  border: 1px solid $hairline-2

.payout-errors
  padding: 10px 12px
  font-size: 13px
  color: $negative
  border-color: rgba(248, 113, 113, 0.4)

.payout-summary
  padding: 12px 14px

.payout-total
  font-size: 20px
</style>
