<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('stargate.title')">
            <q-btn
                flat
                round
                icon="o_compare_arrows"
                :aria-label="$t('validators.title')"
                :to="{ name: 'validators' }"
            />
            <q-btn
                flat
                round
                icon="o_open_in_new"
                :aria-label="$t('a11y.open_external')"
                @click="openURL('https://app.stargate.vechain.org')"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('stargate.msg_intro')}}</p>
            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <q-skeleton
                    v-for="i in 2"
                    :key="i"
                    height="96px"
                />
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load()"
            />
            <empty-state
                v-else-if="!positions.length"
                icon="o_hub"
                :text="$t('stargate.msg_none')"
                :action="$t('stargate.action_open')"
                action-icon="o_open_in_new"
                @action="openURL('https://app.stargate.vechain.org')"
            />
            <template v-else>
                <div class="row q-col-gutter-sm q-mb-md">
                    <div class="col-6">
                        <div class="bvm-tile tile">
                            <div class="text-muted tile-label">{{$t('stargate.label_staked')}}</div>
                            <div class="bvm-amount tile-value">{{formatUnits(totalStaked, 18, 0)}} VET</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="bvm-tile tile">
                            <div class="text-muted tile-label">{{$t('stargate.label_claimable')}}</div>
                            <div class="bvm-amount tile-value">{{formatUnits(totalClaimable, 18, 2)}} VTHO</div>
                        </div>
                    </div>
                </div>
                <q-list role="group" class="bvm-list">
                    <q-item
                        v-for="p in positions"
                        :key="p.owner + p.tokenId"
                    >
                        <q-item-section avatar>
                            <q-avatar
                                icon="o_hub"
                                color="dark"
                                text-color="primary"
                            />
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label class="text-weight-bold">{{p.level}} <span class="text-muted text-weight-regular">#{{p.tokenId}}</span></q-item-label>
                            <q-item-label caption>{{formatUnits(p.staked, 18, 0)}} VET · {{$t(`stargate.status_${p.status}`)}}</q-item-label>
                            <q-item-label
                                v-if="maturity(p)"
                                caption
                                class="text-warning"
                            >{{maturity(p)}}</q-item-label>
                            <q-item-label caption>
                                <address-label :addr="p.owner" />
                            </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <div class="bvm-amount">{{formatUnits(p.claimable, 18, 2)}} VTHO</div>
                            <q-btn
                                v-if="p.claimable > 0n && p.canSign"
                                unelevated
                                dense
                                no-caps
                                color="primary"
                                class="q-px-sm q-mt-xs"
                                :label="$t('stargate.action_claim')"
                                @click="claim(p)"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <p class="text-caption text-muted q-mt-md">{{$t('stargate.msg_manage')}}</p>
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
import { blockTime, sg, STARGATE, stakePositions, type StakePosition } from 'src/utils/ecosystem'
import { selection, selectedWallet, ALL_WALLETS } from 'src/utils/selection'
import { canSign } from 'src/utils/watch'
import { formatUnits, formatDate } from 'src/utils/format'
import { openURL } from 'src/utils/open-url'
import { genesises } from 'src/consts'

type Row = StakePosition & { owner: string, canSign: boolean }

// StarGate: VET staked in node NFTs, and the VTHO they earn
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressLabel },
    data: () => ({
        loading: true,
        error: false,
        positions: [] as Row[],
        wallets: [] as M.Wallet[]
    }),
    computed: {
        totalStaked(): bigint {
            return this.positions.reduce((s, p) => s + p.staked, 0n)
        },
        totalClaimable(): bigint {
            return this.positions.reduce((s, p) => s + p.claimable, 0n)
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        await this.load()
    },
    methods: {
        formatUnits,
        openURL,
        maturity(p: Row): string {
            const head = this.$svc.bc(genesises.main.id).thor.status.head
            if (!p.maturityEndBlock || p.maturityEndBlock <= head.number) return ''
            const when = blockTime(p.maturityEndBlock, head.number, head.timestamp)
            return this.$t('stargate.label_maturing', { when: formatDate(when, { relative: true }) })
        },
        async load() {
            this.loading = true
            this.error = false
            try {
                const main = this.wallets.filter(w => w.gid === genesises.main.id)
                const chosen = selection.walletId === ALL_WALLETS ? main : [selectedWallet(main)].filter((w): w is M.Wallet => !!w)
                const thor = this.$svc.bc(genesises.main.id).thor
                const rows: Row[] = []
                for (const w of chosen) {
                    for (const a of w.meta.addresses) {
                        const list = await stakePositions(thor, a)
                        rows.push(...list.map(p => ({ ...p, owner: a, canSign: canSign(w) })))
                    }
                }
                this.positions = rows
            } catch (err) {
                console.warn('stargate:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        async claim(p: Row) {
            const comment = this.$t('stargate.comment_claim', { level: p.level, id: p.tokenId })
            try {
                await this.$signTx(genesises.main.id, {
                    message: [{ to: STARGATE, value: '0', data: sg.claimRewards.encode(p.tokenId), comment }],
                    options: { signer: p.owner, comment }
                })
                this.$dialog({ component: SuccessDialog, title: this.$t('stargate.title_claimed'), message: this.$t('stargate.msg_claimed', { amount: formatUnits(p.claimable, 18, 2) }) }).catch(() => { })
                setTimeout(() => void this.load(), 12 * 1000)
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.tile
  padding: 12px 14px

.tile-label
  font-size: 12px
  font-weight: 700

.tile-value
  font-size: 18px
  margin-top: 2px
</style>
