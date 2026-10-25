<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="nft ? nft.collection : $t('nft.label_nfts')"
            :gid="wallet?.gid"
        />
        <page-content
            class="col"
            size="md"
        >
            <div
                v-if="!nft"
                class="row justify-center q-py-xl"
            >
                <q-spinner-dots
                    v-if="!error"
                    color="primary"
                    size="28px"
                />
                <div
                    v-else
                    class="column items-center text-muted q-px-lg text-center"
                >
                    <q-icon
                        name="o_cloud_off"
                        size="32px"
                    />
                    <div class="q-mt-sm">{{$t('nft.msg_unreachable')}}</div>
                    <q-btn
                        outline
                        no-caps
                        color="primary"
                        class="q-mt-md"
                        :label="$t('nft.action_retry')"
                        @click="$asyncComputed.nft.update()"
                    />
                </div>
            </div>
            <div
                v-else
                class="q-pa-md"
            >
                <q-img
                    :src="nft.image"
                    :ratio="1"
                    class="hero-image"
                    spinner-color="primary"
                />

                <div class="bvm-label q-mt-lg">{{nft.collection}}</div>
                <h1 class="nft-name bvm-display">{{nft.name}}</h1>

                <div class="row q-gutter-sm q-mt-sm">
                    <div
                        v-if="nft.rank"
                        class="pill"
                    >{{$t('nft.label_rank')}} #{{nft.rank}}</div>
                    <div
                        class="pill"
                        :class="{ 'pill--listed': nft.listed }"
                    >
                        <template v-if="nft.listed && nft.displayPrice">
                            {{$t('nft.label_listed')}} <span class="bvm-amount">{{nft.displayPrice}} {{nft.currency}}</span>
                        </template>
                        <template v-else>{{$t('nft.label_unlisted')}}</template>
                    </div>
                </div>

                <!-- actions -->
                <div class="column q-gutter-y-sm q-mt-lg">
                    <q-btn
                        unelevated
                        no-caps
                        size="lg"
                        color="primary"
                        icon="o_north_east"
                        :label="$t('nft.action_send')"
                        :disable="!canSend"
                        @click="send()"
                    />
                    <div
                        v-if="sendBlock"
                        class="text-muted text-center"
                        style="font-size: 13px"
                    >{{sendBlock}}</div>
                    <q-btn
                        outline
                        no-caps
                        color="primary"
                        icon-right="o_open_in_new"
                        :label="$t('nft.action_view_market')"
                        @click="openURL($svc.bvm.nftPage(nft.contract, nft.tokenId))"
                    />
                </div>

                <p
                    v-if="nft.description"
                    class="description q-mt-lg"
                >{{nft.description}}</p>

                <!-- traits -->
                <template v-if="nft.traits && nft.traits.length">
                    <div class="bvm-label q-mt-lg q-mb-sm">{{$t('nft.label_traits')}}</div>
                    <div class="traits">
                        <div
                            v-for="t in nft.traits"
                            :key="t.trait_type + t.value"
                            class="bvm-tile trait"
                        >
                            <div class="trait-type ellipsis">{{t.trait_type}}</div>
                            <div class="trait-value ellipsis">{{t.value}}</div>
                            <div
                                v-if="t.percentage != null || t.traitFloor"
                                class="trait-meta"
                            >
                                <span v-if="t.percentage != null">{{t.percentage}}%</span>
                                <span v-if="t.traitFloor"> · {{t.traitFloor}}</span>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- details -->
                <div class="bvm-label q-mt-lg q-mb-sm">{{$t('nft.label_details')}}</div>
                <div class="bvm-tile details">
                    <div
                        v-if="lastSale"
                        class="detail row"
                    >
                        <span class="text-muted">{{$t('nft.label_last_sale')}}</span>
                        <span class="q-ml-auto bvm-amount">{{lastSale.displayPrice}} {{lastSale.currency}}</span>
                    </div>
                    <div class="detail row no-wrap">
                        <span class="text-muted">{{$t('nft.label_contract')}}</span>
                        <address-label
                            class="q-ml-auto"
                            :addr="nft.contract"
                        />
                    </div>
                    <div class="detail row">
                        <span class="text-muted">{{$t('nft.label_token_id')}}</span>
                        <span class="q-ml-auto text-weight-bold">{{nft.tokenId}}</span>
                    </div>
                    <div class="detail row">
                        <span class="text-muted">{{$t('nft.label_standard')}}</span>
                        <span class="q-ml-auto text-weight-bold text-uppercase">{{nft.tokenStandard}}</span>
                    </div>
                </div>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { abi, address as addressUtil } from 'thor-devkit'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressLabel from 'components/AddressLabel.vue'
import PromptDialog, { type PromptOptions } from 'pages/Index/PromptDialog.vue'
import { openURL } from 'src/utils/open-url'
import type { BVM } from 'boot/services/bvm'

const erc721TransferFrom = new abi.Function({
    constant: false,
    inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
})

const erc1155SafeTransferFrom = new abi.Function({
    constant: false,
    inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'id', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
        { name: 'data', type: 'bytes' }
    ],
    name: 'safeTransferFrom',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
})

// one NFT of the address, from the BlackVeMarket index; it can be sent from here
export default defineComponent({
    components: { PageToolbar, PageContent, AddressLabel },
    props: {
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true },
        contract: { type: String, required: true },
        tokenId: { type: String, required: true }
    },
    data: () => ({
        error: false,
        // async computed (see src/shims-async-computed.d.ts)
        wallet: null as M.Wallet | null,
        nft: null as BVM.NFT | null
    }),
    asyncComputed: {
        wallet(): Promise<M.Wallet | null> {
            return this.$svc.wallet.get(parseInt(this.walletId))
        },
        async nft(): Promise<BVM.NFT | null> {
            this.error = false
            try {
                return await this.$svc.bvm.nft(this.contract, this.tokenId)
            } catch (err) {
                console.warn('BlackVeMarket nft:', err)
                this.error = true
                return null
            }
        }
    },
    computed: {
        address(): string {
            return this.wallet ? this.wallet.meta.addresses[parseInt(this.addressIndex)] || '' : ''
        },
        isOwner(): boolean {
            return !!this.nft && !!this.address && this.nft.owner.toLowerCase() === this.address.toLowerCase()
        },
        sendBlock(): string {
            if (!this.nft) {
                return ''
            }
            if (this.nft.listed) {
                return this.$t('nft.msg_listed_cannot_send').toString()
            }
            if (!this.isOwner) {
                return this.$t('nft.msg_not_owner').toString()
            }
            return ''
        },
        canSend(): boolean {
            return !!this.nft && !!this.wallet && !this.sendBlock
        },
        lastSale(): { displayPrice: string, currency: string } | null {
            return this.nft?.intelligence?.lastSale || null
        }
    },
    methods: {
        openURL,
        async send() {
            const nft = this.nft
            const wallet = this.wallet
            if (!nft || !wallet || !this.canSend) {
                return
            }
            const from = this.address
            let to: string
            try {
                const opts: PromptOptions = {
                    title: this.$t('nft.action_send').toString(),
                    message: this.$t('nft.msg_send_to').toString(),
                    model: '',
                    action: { label: this.$t('send.action_send').toString(), color: 'primary' },
                    validate: input => {
                        const v = input.trim()
                        if (!addressUtil.test(v)) {
                            return this.$t('send.msg_invalid_address').toString()
                        }
                        if (v.toLowerCase() === from.toLowerCase()) {
                            return this.$t('send.msg_invalid_address').toString()
                        }
                        return ''
                    }
                }
                to = (await this.$dialog<string>({ component: PromptDialog, opts })).trim()
            } catch {
                return
            }

            const data = nft.tokenStandard === 'erc1155'
                ? erc1155SafeTransferFrom.encode(from, to, nft.tokenId, 1, '0x')
                : erc721TransferFrom.encode(from, to, nft.tokenId)
            const comment = `${this.$t('nft.action_send')}: ${nft.name}`
            try {
                await this.$signTx(wallet.gid, {
                    message: [{ to: nft.contract, value: '0', data, comment }],
                    options: { signer: from, comment }
                })
                this.$q.notify(this.$t('nft.msg_sent').toString())
                this.$backOrHome()
            } catch {
                // declined in the transaction dialog
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.hero-image
  border-radius: $radius-lg
  border: 1px solid $hairline
  background: rgba(255, 255, 255, 0.04)

.nft-name
  margin: 6px 0 0
  font-size: clamp(28px, 8vw, 40px)

.pill
  padding: 4px 10px
  border-radius: 999px
  border: 1px solid $hairline-2
  font-size: 13px
  font-weight: 700
  color: $text-soft

.pill--listed
  border-color: rgba(110, 231, 183, 0.5)
  color: $primary

.description
  color: $text-soft
  line-height: 1.55
  max-width: 60ch

.traits
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))
  gap: 8px

.trait
  padding: 10px 12px

.trait-type
  font-size: 12px
  color: $text-muted

.trait-value
  margin-top: 2px
  font-weight: 800

.trait-meta
  margin-top: 4px
  font-size: 12px
  color: $primary

.details
  padding: 4px 14px

.detail
  padding: 10px 0
  font-size: 14px
  & + .detail
    border-top: 1px solid $hairline
</style>
