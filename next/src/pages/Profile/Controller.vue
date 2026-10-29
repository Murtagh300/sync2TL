<template>
    <!-- a public page for a .vet name or an address: open without a wallet -->
    <div class="profile-page fit scroll">
        <div class="profile-wrap q-mx-auto q-px-md">
            <div class="row no-wrap items-center profile-top">
                <img
                    src="~assets/bvm-logo-small.png"
                    alt="BlackVault"
                    class="profile-logo"
                >
                <q-space />
                <q-btn
                    flat
                    no-caps
                    dense
                    color="primary"
                    class="q-px-sm"
                    :label="$t('profile.action_open_app')"
                    :to="{ path: '/' }"
                />
            </div>

            <div
                v-if="loading"
                class="column items-center q-mt-xl"
            >
                <q-skeleton
                    type="circle"
                    size="96px"
                />
                <q-skeleton
                    type="text"
                    width="180px"
                    class="q-mt-md"
                />
            </div>
            <empty-state
                v-else-if="!address"
                icon="o_person_search"
                :text="$t('profile.msg_not_found', { id })"
            />
            <template v-else>
                <div class="column items-center text-center q-mt-lg">
                    <q-avatar
                        size="96px"
                        class="profile-avatar"
                    >
                        <img
                            v-if="avatar"
                            :src="avatar"
                            alt=""
                        >
                        <squad-shades v-if="avatar && squad" />
                        <address-avatar
                            v-else
                            :addr="address"
                        />
                    </q-avatar>
                    <h1 class="bvm-display profile-name q-mt-md q-mb-none">{{title}}</h1>
                    <div
                        v-if="subtitle"
                        class="text-muted profile-sub q-mt-xs"
                    >{{subtitle}}</div>
                    <button
                        type="button"
                        class="profile-address q-mt-sm"
                        :aria-label="$t('common.copy')"
                        @click="copy(checksumed)"
                    >
                        {{checksumed.slice(0, 6)}}…{{checksumed.slice(-4)}}
                        <q-icon
                            name="o_content_copy"
                            size="14px"
                        />
                    </button>
                    <div
                        v-if="holdings"
                        class="row q-gutter-x-lg q-mt-md profile-stats"
                    >
                        <div><b class="bvm-amount">{{holdings.summary.total}}</b> {{$t('profile.label_nfts')}}</div>
                        <div v-if="holdings.summary.listed"><b class="bvm-amount">{{holdings.summary.listed}}</b> {{$t('profile.label_for_sale')}}</div>
                    </div>
                </div>

                <div class="row no-wrap q-gutter-x-sm q-mt-lg">
                    <q-btn
                        class="col"
                        unelevated
                        no-caps
                        color="primary"
                        icon="o_payments"
                        :label="$t('profile.action_pay')"
                        @click="pay()"
                    />
                    <q-btn
                        class="col"
                        outline
                        no-caps
                        color="primary"
                        icon="o_ios_share"
                        :label="$t('profile.action_share')"
                        @click="share()"
                    />
                </div>

                <template v-if="nfts.length">
                    <div class="bvm-label q-mt-xl q-mb-sm">{{$t('profile.label_showcase')}}</div>
                    <div class="showcase">
                        <div
                            v-for="n in nfts"
                            :key="n.contract + n.tokenId"
                            class="showcase-item bvm-tile"
                        >
                            <q-img
                                :src="n.image"
                                :ratio="1"
                                class="showcase-img"
                                loading="lazy"
                                no-spinner
                            />
                            <div class="showcase-name ellipsis">{{n.name || `#${n.tokenId}`}}</div>
                        </div>
                    </div>
                </template>
                <p class="text-caption text-muted text-center q-mt-xl q-mb-lg">{{$t('profile.msg_public')}}</p>
            </template>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address as addressUtil } from 'thor-devkit'
import SquadShades from 'components/SquadShades.vue'
import { holdsSquad } from 'src/utils/squad'
import { genesises } from 'src/consts'
import EmptyState from 'components/EmptyState.vue'
import AddressAvatar from 'components/AddressAvatar.vue'
import ReceiveDialog from 'pages/Address/ReceiveDialog.vue'
import type { BVM } from 'boot/services/bvm'
import { isVetName, resolveVetName } from 'src/utils/names'
import { copyText } from 'src/utils/clipboard'
import { profileLink } from 'src/utils/profile'

// thor-devkit's test() is a type guard, which narrows the text away when it fails
const isAddress = (v: string): boolean => addressUtil.test(v)

export default defineComponent({
    components: { EmptyState, AddressAvatar, SquadShades },
    props: {
        id: { type: String, required: true }
    },
    data: () => ({
        loading: true,
        address: '',
        vetName: '',
        displayName: '',
        avatar: '',
        /** a SQUAD holder's own picture wears the sunglasses too */
        squad: false,
        holdings: null as BVM.Holdings | null
    }),
    computed: {
        checksumed(): string {
            return this.address ? addressUtil.toChecksumed(this.address) : ''
        },
        title(): string {
            return this.vetName || this.displayName || `${this.checksumed.slice(0, 6)}…${this.checksumed.slice(-4)}`
        },
        /** the BlackVeMarket name under a .vet name, when they differ */
        subtitle(): string {
            return this.vetName && this.displayName && this.displayName.toLowerCase() !== this.vetName.toLowerCase() ? this.displayName : ''
        },
        /** twelve, taking turns between collections so one doesn't fill the showcase */
        nfts(): BVM.NFT[] {
            const groups = new Map<string, BVM.NFT[]>()
            for (const n of (this.holdings?.holdings || []).filter(n => !!n.image)) {
                groups.set(n.collectionSlug, [...(groups.get(n.collectionSlug) || []), n])
            }
            const lists = [...groups.values()]
            const out: BVM.NFT[] = []
            for (let i = 0; out.length < 12 && lists.some(l => l.length > i); i++) {
                for (const l of lists) if (l[i] && out.length < 12) out.push(l[i]!)
            }
            return out
        }
    },
    watch: {
        id: { handler() { void this.load() }, immediate: true },
        title(t: string) {
            document.title = `${t} · BlackVault`
        }
    },
    unmounted() {
        document.title = 'BlackVault'
    },
    methods: {
        async load() {
            this.loading = true
            this.address = ''
            try {
                const id = decodeURIComponent(this.id).trim()
                if (isAddress(id)) {
                    this.address = id.toLowerCase()
                } else if (isVetName(id)) {
                    this.address = (await resolveVetName(id))?.toLowerCase() || ''
                    if (this.address) this.vetName = id.toLowerCase()
                }
                if (!this.address) return
                const bvm = this.$svc.bvm
                const [name, profile, holdings] = await Promise.all([
                    this.vetName ? Promise.resolve(this.vetName) : bvm.vetName(this.address).catch(() => ''),
                    bvm.profile(this.address),
                    bvm.holdings(this.address, { limit: 60 }).catch(() => null)
                ])
                this.vetName = name
                this.displayName = profile?.displayName || ''
                this.avatar = profile?.avatar || ''
                if (this.address) holdsSquad(this.$svc.bc(genesises.main.id).thor, this.address).then(v => { this.squad = v }).catch(() => { })
                this.holdings = holdings
            } catch (err) {
                console.warn('profile:', err)
            } finally {
                this.loading = false
            }
        },
        copy(text: string) {
            copyText(text).then(() => this.$q.notify(this.$t('common.copied'))).catch(() => { })
        },
        /** the QR code, the address in blocks of four and an amount to ask for */
        pay() {
            this.$dialog({ component: ReceiveDialog, address: this.address, visitor: true, title: this.$t('profile.title_pay', { name: this.title }) }).catch(() => { })
        },
        share() {
            const url = profileLink(this.vetName || this.checksumed)
            if (typeof navigator.share === 'function') {
                navigator.share({ title: this.title, url }).catch(() => { })
            } else {
                this.copy(url)
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.profile-page
  background: $dark-page
  overflow-y: auto

.profile-wrap
  max-width: 560px
  padding-top: env(safe-area-inset-top)
  padding-bottom: env(safe-area-inset-bottom)

.profile-top
  min-height: 56px

.profile-logo
  height: 22px
  width: auto

.profile-avatar
  background: rgba(255, 255, 255, 0.05)
  border: 2px solid $hairline-2
  img
    object-fit: cover
  :deep(.q-avatar__content)
    position: relative

.profile-name
  font-size: clamp(26px, 8vw, 36px)
  overflow-wrap: anywhere

.profile-sub
  font-size: 14px

.profile-address
  border: 1px solid $hairline-2
  border-radius: 999px
  background: none
  color: $text-soft
  font: inherit
  font-size: 13px
  font-variant-numeric: tabular-nums
  padding: 4px 12px
  cursor: pointer

.profile-stats
  font-size: 14px
  color: $text-soft
  b
    color: $text

.showcase
  display: grid
  grid-template-columns: repeat(3, minmax(0, 1fr))
  gap: 8px

.showcase-item
  overflow: hidden
  padding: 0

.showcase-name
  font-size: 12px
  font-weight: 700
  padding: 6px 8px
</style>
