<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="launch ? launch.name : $t('launchpad.title')" />
        <page-content
            class="col"
            size="md"
        >
            <div
                v-if="!launch"
                class="row justify-center q-py-xl"
            >
                <q-spinner-dots
                    v-if="!error"
                    size="32px"
                />
                <div
                    v-else
                    class="text-muted"
                >{{$t('nft.msg_unreachable')}}</div>
            </div>
            <div
                v-else
                class="q-pa-md"
            >
                <q-img
                    :src="launch.bannerImage || launch.coverImage"
                    :ratio="16/9"
                    class="banner"
                />
                <h1 class="bvm-display launch-title">{{launch.name}}</h1>
                <div class="text-muted">{{launch.mintedCount}} / {{launch.maxSupply}} {{$t('launchpad.label_minted')}}</div>
                <q-linear-progress
                    :value="launch.publicSupply ? launch.publicMinted / launch.publicSupply : 0"
                    color="primary"
                    track-color="grey-9"
                    rounded
                    size="8px"
                    class="q-mt-sm"
                />
                <p
                    v-if="launch.description"
                    class="text-soft q-mt-md description"
                >{{launch.description}}</p>

                <div class="bvm-label q-mt-lg q-mb-sm">{{$t('launchpad.label_phases')}}</div>
                <q-list role="group" class="bvm-list">
                    <q-item
                        v-for="p in launch.phases || []"
                        :key="p.index"
                        :clickable="p.state === 'live'"
                        :active="phase === p"
                        @click="p.state === 'live' && (phase = p)"
                    >
                        <q-item-section>
                            <q-item-label>{{p.label}}</q-item-label>
                            <q-item-label caption>
                                {{phaseText(p)}}
                            </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <div
                                class="phase-state"
                                :class="`phase-state--${p.state}`"
                            >{{$t(`launchpad.state_${p.state === 'live' ? 'live' : p.state === 'upcoming' ? 'upcoming' : 'ended'}`)}}</div>
                        </q-item-section>
                    </q-item>
                </q-list>

                <!-- mint -->
                <div
                    v-if="phase"
                    class="bvm-tile q-pa-md q-mt-md"
                >
                    <template v-if="mintable">
                        <div class="row no-wrap items-center">
                            <q-btn
                                :aria-label="$t('a11y.less')"
                                round
                                outline
                                dense
                                icon="remove"
                                :disable="quantity <= 1"
                                @click="quantity--"
                            />
                            <div class="bvm-display quantity text-center col">{{quantity}}</div>
                            <q-btn
                                :aria-label="$t('common.add')"
                                round
                                outline
                                dense
                                icon="add"
                                :disable="quantity >= maxQuantity"
                                @click="quantity++"
                            />
                        </div>
                        <div class="text-center text-muted q-mt-sm">
                            {{$t('launchpad.label_total')}}: <span class="bvm-amount text-white">{{total}} {{phase.paySymbol}}</span>
                        </div>
                        <q-btn
                            unelevated
                            no-caps
                            size="lg"
                            color="primary"
                            icon="o_auto_awesome"
                            class="full-width q-mt-md"
                            :label="$t('launchpad.action_mint', { n: quantity })"
                            @click="mint()"
                        />
                    </template>
                    <template v-else>
                        <p class="text-soft q-mt-none">{{$t('launchpad.msg_on_site')}}</p>
                        <q-btn
                            outline
                            no-caps
                            color="primary"
                            class="full-width"
                            icon-right="o_open_in_new"
                            :label="$t('nft.action_view_market')"
                            @click="openSite()"
                        />
                    </template>
                </div>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import { marketURL, type BVM } from 'boot/services/bvm'
import { formatUnits } from 'src/utils/format'
import { mintClauses } from 'src/utils/market'
import { openURL } from 'src/utils/open-url'
import { genesises } from 'src/consts'
import SuccessDialog from 'components/SuccessDialog.vue'

// one launch: its phases, and minting from the live one
export default defineComponent({
    components: { PageToolbar, PageContent },
    props: {
        slug: { type: String, required: true }
    },
    data: () => ({
        launch: null as BVM.Launch | null,
        error: false,
        phase: null as BVM.LaunchPhase | null,
        quantity: 1
    }),
    computed: {
        /** a fixed price without gates or burns: the wallet can mint it; the rest goes to the site */
        mintable(): boolean {
            const p = this.phase
            return !!p && p.state === 'live' && !this.launch?.mintPaused &&
                !(p.steps && p.steps.length) && !(p.gates && p.gates.length) && !p.burnToken && p.kind === 'public'
        },
        maxQuantity(): number {
            const p = this.phase
            const left = this.launch ? Math.max(this.launch.publicSupply - this.launch.publicMinted, 0) : 0
            return Math.max(1, Math.min(p?.perWallet || 10, left || 1, 20))
        },
        total(): string {
            return this.phase ? formatUnits(BigInt(this.phase.priceWei || '0') * BigInt(this.quantity), 18) : '0'
        }
    },
    async created() {
        try {
            const all = await this.$svc.bvm.launches()
            this.launch = all.find(l => l.slug === this.slug) || null
            this.error = !this.launch
            this.phase = (this.launch?.phases || []).find(p => p.state === 'live') || null
        } catch {
            this.error = true
        }
    },
    methods: {
        phaseText(p: BVM.LaunchPhase): string {
            const price = BigInt(p.priceWei || '0') === 0n ? this.$t('launchpad.label_free') : `${formatUnits(p.priceWei, 18)} ${p.paySymbol}`
            return p.perWallet ? `${price} · ${this.$t('launchpad.label_per_wallet', { n: p.perWallet })}` : price
        },
        openSite() {
            openURL(`${marketURL}/launchpad/${this.slug}`)
        },
        async mint() {
            const launch = this.launch
            const phase = this.phase
            if (!launch || !phase || !this.mintable) {
                return
            }
            const comment = this.$t('launchpad.comment_mint', { n: this.quantity, name: launch.name })
            try {
                // the signer is chosen in the transaction dialog; it shows when a wallet may not mint more
                await this.$signTx(genesises.main.id, {
                    message: mintClauses(launch.contractAddress, phase.index, this.quantity, phase.priceWei, phase.payToken)
                        .map(c => ({ ...c, comment })),
                    options: { comment }
                })
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('launchpad.msg_minted'), image: launch.coverImage }).catch(() => { })
            } catch {
                // declined in the transaction dialog
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.banner
  border-radius: $radius-lg

.launch-title
  font-size: 32px
  margin: 16px 0 4px

.description
  white-space: pre-line
  max-height: 12em
  overflow: hidden

.quantity
  font-size: 36px

.phase-state
  font-size: 11px
  font-weight: 800
  color: $text-muted

.phase-state--live
  color: var(--q-primary)
</style>
