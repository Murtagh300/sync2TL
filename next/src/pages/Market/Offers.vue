<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('offerInbox.title')" />
        <page-content
            class="col"
            padding
        >
            <q-tabs
                v-model="tab"
                dense
                no-caps
                align="left"
                active-color="primary"
                indicator-color="primary"
                class="q-mb-md"
            >
                <q-tab
                    name="received"
                    :label="$t('offerInbox.tab_received', { n: received.length })"
                />
                <q-tab
                    name="made"
                    :label="$t('offerInbox.tab_made')"
                />
            </q-tabs>

            <!-- on your NFTs -->
            <template v-if="tab === 'received'">
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
                    v-else-if="!received.length"
                    icon="o_local_offer"
                    :text="$t('offerInbox.msg_none_received')"
                />
                <q-list
                    role="group"
                    v-else
                    class="bvm-list"
                >
                    <q-item
                        v-for="r in received"
                        :key="r.nft.contract + r.nft.tokenId + r.offer.id"
                        clickable
                        @click="open(r.nft, r.owner)"
                    >
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
                            >{{$t('offerInbox.label_from')}} <address-label :addr="r.offer.buyer" /></q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <span class="bvm-amount">{{r.offer.displayAmount}} {{r.offer.currency}}</span>
                            <q-btn
                                v-if="r.canSign && tradable(r.nft)"
                                unelevated
                                dense
                                no-caps
                                color="primary"
                                class="q-px-sm q-mt-xs"
                                :label="$t('market.action_accept')"
                                @click.stop="accept(r)"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
            </template>

            <!-- the ones you made: BlackVeMarket shows them to a signed-in wallet -->
            <template v-else>
                <div
                    v-if="made === null"
                    class="bvm-tile q-pa-md text-center"
                >
                    <p class="text-soft">{{$t('offerInbox.msg_sign_in')}}</p>
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        icon="o_login"
                        :loading="signingIn"
                        :disable="!signerAddress"
                        :label="$t('offerInbox.action_sign_in')"
                        @click="signIn()"
                    />
                </div>
                <empty-state
                    v-else-if="!made.length"
                    icon="o_local_offer"
                    :text="$t('offerInbox.msg_none_made')"
                />
                <q-list
                    role="group"
                    v-else
                    class="bvm-list"
                >
                    <q-item
                        v-for="(m, k) in made"
                        :key="k"
                        :clickable="!!(m.contract && m.tokenId)"
                        @click="m.contract && m.tokenId && open({ contract: m.contract, tokenId: m.tokenId }, signerAddress)"
                    >
                        <q-item-section avatar>
                            <q-avatar
                                rounded
                                size="44px"
                            >
                                <img
                                    v-if="m.image"
                                    :src="m.image"
                                    alt=""
                                    loading="lazy"
                                >
                                <q-icon
                                    v-else
                                    name="o_local_offer"
                                />
                            </q-avatar>
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label
                                lines="1"
                                class="text-weight-bold"
                            >{{m.name}}</q-item-label>
                            <q-item-label
                                v-if="m.collection"
                                caption
                                lines="1"
                            >{{m.collection}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <span class="bvm-amount">{{m.amount}}</span>
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
import SuccessDialog from 'components/SuccessDialog.vue'
import { acceptOfferClauses, canTrade, signMarketTx } from 'src/utils/market'
import { bvmSession, bvmSignIn, madeOffers, signInMessage, type MadeOffer } from 'src/utils/push'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { genesises } from 'src/consts'
import type { BVM } from 'boot/services/bvm'

type Received = { nft: BVM.NFT, offer: BVM.Offer, owner: string, walletId: number, canSign: boolean }

// offers on your NFTs and the ones you made, in one place
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressLabel },
    data: () => ({
        tab: 'received' as 'received' | 'made',
        received: [] as Received[],
        made: null as MadeOffer[] | null,
        loading: true,
        signingIn: false,
        wallets: [] as M.Wallet[]
    }),
    computed: {
        chosen(): M.Wallet[] {
            const main = this.wallets.filter(w => w.gid === genesises.main.id)
            return selection.walletId === ALL_WALLETS ? main : [selectedWallet(main)].filter((w): w is M.Wallet => !!w)
        },
        /** the address that signs in on BlackVeMarket for "made" */
        signerAddress(): string {
            return this.chosen.find(canSign)?.meta.addresses[0] || ''
        }
    },
    watch: {
        tab(t: string) {
            if (t === 'made') void this.loadMade()
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        await this.loadReceived()
    },
    methods: {
        tradable(nft: BVM.NFT) {
            return canTrade(nft)
        },
        open(nft: { contract: string, tokenId: string }, owner: string) {
            const w = this.wallets.find(x => x.meta.addresses.includes(owner)) || this.chosen[0]
            if (!w) return
            void this.$router.push({ name: 'nft', params: { walletId: String(w.id), addressIndex: String(Math.max(0, w.meta.addresses.indexOf(owner))), contract: nft.contract, tokenId: nft.tokenId } })
        },
        /** the NFTs with offers, then each one's offers */
        async loadReceived() {
            this.loading = true
            const out: Received[] = []
            try {
                for (const w of this.chosen) {
                    for (const a of w.meta.addresses) {
                        const withOffers: BVM.NFT[] = []
                        for (let offset = 0; offset < 500;) {
                            const h = await this.$svc.bvm.holdings(a, { limit: 100, offset }).catch(() => null)
                            if (!h) break
                            withOffers.push(...h.holdings.filter(n => (n.offerCount || 0) > 0))
                            if (!h.pagination.hasMore) break
                            offset = h.pagination.nextOffset
                        }
                        for (const n of withOffers.slice(0, 40)) {
                            const d = await this.$svc.bvm.nftWithActivity(n.contract, n.tokenId).catch(() => null)
                            for (const o of (d?.nft.offers || []).filter(x => !!x && !!x.amount)) {
                                out.push({ nft: d!.nft, offer: o, owner: a, walletId: w.id, canSign: canSign(w) })
                            }
                        }
                    }
                }
                // the highest first, within a currency
                this.received = out.sort((x, y) => {
                    const a = BigInt(x.offer.amount)
                    const b = BigInt(y.offer.amount)
                    return x.offer.currency.localeCompare(y.offer.currency) || (b > a ? 1 : b < a ? -1 : 0)
                })
            } finally {
                this.loading = false
            }
        },
        async loadMade() {
            if (!this.signerAddress) return
            try {
                this.made = await madeOffers(this.signerAddress)
            } catch {
                // not signed in there
                this.made = null
            }
        },
        async signIn() {
            const address = this.signerAddress
            if (!address) return
            this.signingIn = true
            try {
                if (await bvmSession() !== address.toLowerCase()) {
                    const message = signInMessage()
                    const resp = await this.$signCert(genesises.main.id, { message, options: { signer: address }, domain: 'blackvemarket.com', origin: 'https://blackvemarket.com' })
                    await bvmSignIn({ ...message, ...resp.annex, signature: resp.signature })
                }
                await this.loadMade()
            } catch { } finally {
                this.signingIn = false
            }
        },
        async accept(r: Received) {
            const comment = this.$t('market.comment_accept', { amount: `${r.offer.displayAmount} ${r.offer.currency}`, nft: r.nft.name })
            try {
                await signMarketTx(this.$signTx, this.$svc.bvm, genesises.main.id, r.owner, acceptOfferClauses(r.nft, r.offer), comment)
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('market.msg_accepted'), image: r.nft.image }).catch(() => { })
                setTimeout(() => void this.loadReceived(), 12 * 1000)
            } catch { }
        }
    }
})
</script>
