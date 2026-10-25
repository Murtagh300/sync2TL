<template>
    <div class="fit column no-wrap">
        <page-toolbar
            :title="$t('approvals.title')"
            :gid="wallet?.gid"
        >
            <q-btn
                flat
                round
                icon="o_refresh"
                :disable="loading"
                @click="load()"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <p class="text-soft q-mb-md">{{$t('approvals.msg_intro')}}<help-tip term="approval" /></p>
            <div
                v-if="loading"
                class="column flex-center q-py-xl"
            >
                <q-spinner-dots size="40px" />
                <div class="text-muted q-mt-sm">{{$t('approvals.msg_scanning')}}</div>
            </div>
            <div
                v-else-if="error"
                class="bvm-tile q-pa-md text-center"
            >
                <p>{{$t('common.something_wrong')}}</p>
                <q-btn
                    outline
                    color="primary"
                    :label="$t('nft.action_retry')"
                    @click="load()"
                />
            </div>
            <div
                v-else-if="approvals.length === 0"
                class="bvm-tile q-pa-lg text-center"
            >
                <q-icon
                    name="o_verified_user"
                    size="36px"
                    color="primary"
                />
                <div class="text-weight-bold q-mt-sm">{{$t('approvals.msg_none')}}</div>
            </div>
            <q-list
                v-else
                class="bvm-list"
            >
                <q-item
                    v-for="a in approvals"
                    :key="`${a.kind}:${a.contract}:${a.spender}`"
                >
                    <q-item-section avatar>
                        <token-avatar
                            v-if="a.kind === 'token' && token(a.contract)"
                            :spec="token(a.contract)!"
                            size="34px"
                        />
                        <q-avatar
                            v-else
                            :icon="a.kind === 'nft' ? 'o_image' : 'o_toll'"
                        />
                    </q-item-section>
                    <q-item-section style="min-width: 0">
                        <q-item-label lines="1">{{subject(a)}}</q-item-label>
                        <q-item-label
                            caption
                            lines="1"
                        >{{$t('approvals.label_spender')}}: {{who(a.spender)}}</q-item-label>
                        <q-item-label
                            caption
                            lines="1"
                            :class="riskClass(a)"
                        >{{scope(a)}}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <q-btn
                            outline
                            dense
                            no-caps
                            color="negative"
                            class="q-px-sm"
                            :label="$t('approvals.action_revoke')"
                            @click="revoke([a])"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </page-content>
        <page-action v-if="approvals.length > 1">
            <q-btn
                outline
                color="negative"
                :label="$t('approvals.action_revoke_all', { n: approvals.length })"
                @click="revoke(approvals)"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import HelpTip from 'components/HelpTip.vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import TokenAvatar from 'components/TokenAvatar.vue'
import { findApprovals, revokeClause, type Approval } from 'src/utils/approvals'
import { contractName, UNLIMITED } from 'src/utils/actions'
import { who } from 'src/utils/describe-action'
import { formatUnits } from 'src/utils/format'
import type { BVM } from 'boot/services/bvm'
import SuccessDialog from 'components/SuccessDialog.vue'

// what this address lets others spend or move, with a way to take it back
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, TokenAvatar, HelpTip },
    props: {
        walletId: { type: String, required: true },
        addressIndex: { type: String, required: true }
    },
    data: () => ({
        loading: false,
        error: false,
        approvals: [] as Approval[],
        tokens: [] as M.TokenSpec[],
        collections: {} as Record<string, BVM.Collection>,
        // async computed (see src/shims-async-computed.d.ts)
        wallet: null as M.Wallet | null
    }),
    asyncComputed: {
        wallet(): Promise<M.Wallet | null> {
            return this.$svc.wallet.get(parseInt(this.walletId))
        }
    },
    computed: {
        address(): string {
            return this.wallet?.meta.addresses[parseInt(this.addressIndex)] || ''
        }
    },
    watch: {
        address: {
            handler(addr: string) {
                addr && void this.load()
            },
            immediate: true
        }
    },
    methods: {
        who,
        async load() {
            const wallet = this.wallet
            if (!wallet || !this.address) {
                return
            }
            this.loading = true
            this.error = false
            try {
                const [found, all, collections] = await Promise.all([
                    findApprovals(this.$svc.bc(wallet.gid).thor, this.address),
                    this.$svc.config.token.all(),
                    this.$svc.bvm.supports(wallet.gid)
                        ? this.$svc.bvm.collections().catch(() => ({} as Record<string, BVM.Collection>))
                        : Promise.resolve({} as Record<string, BVM.Collection>)
                ])
                this.tokens = all.filter(t => t.gid === wallet.gid)
                this.collections = collections
                // the riskiest first: unknown spenders, then unlimited ones
                const weight = (a: Approval) => (contractName(a.spender) ? 0 : 2) + (a.kind === 'nft' || a.allowance >= UNLIMITED ? 1 : 0)
                this.approvals = found.sort((x, y) => weight(y) - weight(x))
            } catch (err) {
                console.warn('approvals:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        token(address: string): M.TokenSpec | undefined {
            return this.tokens.find(t => t.address.toLowerCase() === address)
        },
        subject(a: Approval): string {
            if (a.kind === 'nft') {
                return this.collections[a.contract]?.name || `${a.contract.slice(0, 6)}…${a.contract.slice(-4)}`
            }
            return this.token(a.contract)?.symbol || `${a.contract.slice(0, 6)}…${a.contract.slice(-4)}`
        },
        scope(a: Approval): string {
            if (a.kind === 'nft') {
                return this.$t('approvals.label_all_nfts')
            }
            if (a.allowance >= UNLIMITED) {
                return this.$t('approvals.label_unlimited')
            }
            const spec = this.token(a.contract)
            return this.$t('approvals.label_up_to', { amount: spec ? `${formatUnits(a.allowance, spec.decimals)} ${spec.symbol}` : a.allowance.toString() })
        },
        riskClass(a: Approval): string {
            const wide = a.kind === 'nft' || a.allowance >= UNLIMITED
            if (!contractName(a.spender)) {
                return wide ? 'text-negative' : 'text-warning'
            }
            return wide ? 'text-warning' : ''
        },
        async revoke(list: Approval[]) {
            const wallet = this.wallet
            if (!wallet || list.length === 0) {
                return
            }
            const comment = list.length === 1
                ? this.$t('approvals.comment_revoke', { subject: this.subject(list[0]!), spender: who(list[0]!.spender) })
                : this.$t('approvals.comment_revoke_all', { n: list.length })
            try {
                await this.$signTx(wallet.gid, {
                    message: list.map(a => ({ ...revokeClause(a), comment })),
                    options: { signer: this.address, comment }
                })
                // gone once the transaction is in; drop them now
                const done = new Set(list)
                this.approvals = this.approvals.filter(a => !done.has(a))
                this.$dialog({ component: SuccessDialog, title: comment, message: this.$t('approvals.msg_revoked') }).catch(() => { })
            } catch {
                // declined in the transaction dialog
            }
        }
    }
})
</script>
