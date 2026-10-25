<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('listings.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('listings.msg_intro')}}</p>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 3"
                    :key="i"
                    height="64px"
                />
            </div>
            <empty-state
                v-else-if="!rows.length"
                icon="o_sell"
                :text="$t('listings.msg_none')"
            />
            <template v-else>
                <div class="row items-center q-mb-sm">
                    <q-checkbox
                        :model-value="allSelected"
                        :label="$t('listings.label_select_all', { n: rows.length })"
                        @update:model-value="selectAll"
                    />
                </div>
                <q-list class="bvm-list">
                    <q-item
                        v-for="r in rows"
                        :key="r.owner + r.nft.contract + r.nft.tokenId"
                        tag="label"
                    >
                        <q-item-section side>
                            <q-checkbox
                                v-model="selected"
                                :val="key(r)"
                                :disable="!r.canSign"
                            />
                        </q-item-section>
                        <q-item-section avatar>
                            <q-avatar
                                rounded
                                size="44px"
                            >
                                <img
                                    :src="r.nft.image"
                                    alt=""
                                    loading="lazy"
                                >
                            </q-avatar>
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label
                                lines="1"
                                class="text-weight-bold"
                            >{{r.nft.name}}</q-item-label>
                            <q-item-label
                                caption
                                lines="1"
                            >{{r.nft.collection}}<template v-if="floorOf(r)"> · {{$t('listings.label_floor', { floor: floorOf(r) })}}</template></q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <span class="bvm-amount">{{r.nft.displayPrice}} {{r.nft.currency}}</span>
                            <span
                                v-if="r.nft.offerCount"
                                class="text-caption text-primary"
                            >{{$t('nft.label_offer_count', { n: r.nft.offerCount })}}</span>
                        </q-item-section>
                    </q-item>
                </q-list>
            </template>
        </page-content>
        <page-action v-if="selected.length">
            <div class="row no-wrap q-gutter-x-sm full-width">
                <q-btn
                    class="col"
                    unelevated
                    no-caps
                    color="primary"
                    icon="o_edit"
                    :loading="working"
                    :label="$t('listings.action_reprice', { n: selected.length })"
                    @click="reprice()"
                />
                <q-btn
                    class="col"
                    outline
                    no-caps
                    color="negative"
                    icon="o_cancel"
                    :loading="working"
                    :label="$t('listings.action_cancel', { n: selected.length })"
                    @click="cancel()"
                />
            </div>
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import EmptyState from 'components/EmptyState.vue'
import SuccessDialog from 'components/SuccessDialog.vue'
import ListDialog, { type ListResult } from 'pages/Nft/ListDialog.vue'
import { cancelListingClauses, listingCurrencies, repriceClauses, signMarketTx, type Clause } from 'src/utils/market'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { toWei } from 'src/utils/format'
import { genesises } from 'src/consts'
import type { BVM } from 'boot/services/bvm'

type Row = { nft: BVM.NFT, owner: string, canSign: boolean }

// every NFT you have for sale, with the price changed or the listing ended in bulk
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, EmptyState },
    data: () => ({
        rows: [] as Row[],
        selected: [] as string[],
        loading: true,
        working: false
    }),
    computed: {
        allSelected(): boolean {
            const signable = this.rows.filter(r => r.canSign)
            return !!signable.length && signable.every(r => this.selected.includes(this.key(r)))
        },
        chosen(): Row[] {
            return this.rows.filter(r => this.selected.includes(this.key(r)))
        }
    },
    async created() {
        await this.load()
    },
    methods: {
        key(r: Row) {
            return `${r.owner}:${r.nft.contract}:${r.nft.tokenId}`
        },
        floorOf(r: Row): string {
            return r.nft.intelligence?.collection?.floor || ''
        },
        selectAll(on: boolean) {
            this.selected = on ? this.rows.filter(r => r.canSign).map(r => this.key(r)) : []
        },
        async load() {
            this.loading = true
            try {
                const main = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const chosen = selection.walletId === ALL_WALLETS ? main : [selectedWallet(main)].filter((w): w is M.Wallet => !!w)
                const rows: Row[] = []
                for (const w of chosen) {
                    for (const a of w.meta.addresses) {
                        const listed = await this.$svc.bvm.listings(a, 100).catch(() => [] as BVM.NFT[])
                        rows.push(...listed.map(nft => ({ nft, owner: a, canSign: canSign(w) })))
                    }
                }
                this.rows = rows
                this.selected = this.selected.filter(k => rows.some(r => this.key(r) === k))
            } finally {
                this.loading = false
            }
        },
        /** one transaction per owner (each address signs its own) */
        async sign(build: (rows: Row[]) => Clause[], comment: (n: number) => string, done: string) {
            const byOwner = new Map<string, Row[]>()
            this.chosen.forEach(r => byOwner.set(r.owner, [...(byOwner.get(r.owner) || []), r]))
            this.working = true
            let ok = 0
            try {
                for (const [owner, rows] of byOwner) {
                    await signMarketTx(this.$signTx, this.$svc.bvm, genesises.main.id, owner, build(rows), comment(rows.length))
                    ok += rows.length
                }
            } catch {
                // declined: what was signed is on its way
            } finally {
                this.working = false
            }
            if (ok) {
                this.$dialog({ component: SuccessDialog, title: comment(ok), message: done }).catch(() => { })
                this.selected = []
                setTimeout(() => void this.load(), 12 * 1000)
            }
        },
        async reprice() {
            let r: ListResult
            try {
                r = await this.$dialog<ListResult>({
                    component: ListDialog,
                    title: this.$t('market.action_reprice'),
                    action: this.$t('market.action_reprice'),
                    message: this.$t('nft.msg_bulk_price', { n: this.chosen.length })
                })
            } catch {
                return
            }
            const wei = toWei(r.price, 18)
            const token = listingCurrencies[r.symbol]!
            await this.sign(
                rows => rows.flatMap(x => repriceClauses(x.nft, wei, token)),
                n => this.$t('listings.comment_reprice', { n, price: `${r.price} ${r.symbol}` }),
                this.$t('market.msg_listed')
            )
        },
        async cancel() {
            await this.sign(
                rows => cancelListingClauses(rows.map(x => x.nft)),
                n => this.$t('listings.comment_cancel', { n }),
                this.$t('market.msg_cancelled')
            )
        }
    }
})
</script>
