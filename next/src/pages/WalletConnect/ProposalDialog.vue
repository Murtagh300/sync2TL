<template>
    <q-dialog
        ref="dialog"
        persistent
        :position="$q.screen.xs ? 'bottom' : 'standard'"
        @hide="$emit('hide')"
    >
        <q-card class="full-width proposal">
            <q-card-section class="text-center q-pt-lg">
                <q-avatar
                    size="56px"
                    rounded
                    class="dapp-icon"
                >
                    <img
                        v-if="proposal.icon && /^https:/.test(proposal.icon)"
                        :src="proposal.icon"
                        alt=""
                    >
                    <q-icon
                        v-else
                        name="o_apps"
                    />
                </q-avatar>
                <h2 class="bvm-display title">{{proposal.name}}</h2>
                <div class="text-muted">{{host}}</div>
                <div
                    class="verify q-mt-sm"
                    :class="`verify--${level}`"
                >
                    <q-icon
                        :name="level === 'ok' ? 'o_verified' : level === 'bad' ? 'o_gpp_bad' : 'o_help_outline'"
                        size="16px"
                    />
                    {{$t(`wc.verify_${level}`)}}
                </div>
                <risk-card
                    :labels="siteRisks"
                    class="q-mt-md text-left"
                />
                <p class="text-soft q-mt-md q-mb-none">{{$t('wc.msg_connect')}}</p>
            </q-card-section>
            <q-card-section class="q-pt-none">
                <q-select
                    v-if="proposal.gids.length > 1"
                    v-model="gid"
                    :options="proposal.gids.map(g => ({ label: $netDisplayName(g), value: g }))"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('wc.label_network')"
                    class="q-mb-sm"
                />
                <q-select
                    v-model="address"
                    :options="addresses"
                    emit-value
                    map-options
                    outlined
                    dense
                    :label="$t('wc.label_address')"
                    :disable="!addresses.length"
                />
                <div
                    v-if="!addresses.length"
                    class="text-negative text-caption q-mt-xs"
                >{{$t('wc.msg_no_wallet', { network: $netDisplayName(gid) })}}</div>
                <ul class="can text-caption text-muted q-mt-md q-mb-none">
                    <li>{{$t('wc.can_see')}}</li>
                    <li>{{$t('wc.can_ask')}}</li>
                    <li>{{$t('wc.cannot')}}</li>
                </ul>
            </q-card-section>
            <q-card-actions class="q-px-md q-pb-md column q-gutter-y-sm">
                <q-btn
                    class="full-width"
                    unelevated
                    no-caps
                    size="lg"
                    :color="level === 'bad' ? 'grey-9' : 'primary'"
                    :disable="!address"
                    :label="$t('wc.action_connect')"
                    @click="ok()"
                />
                <q-btn
                    class="full-width"
                    flat
                    no-caps
                    :label="$t('common.decline')"
                    @click="hide()"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { QDialog } from 'quasar'
import type { WcProposal } from 'src/utils/walletconnect'
import { canSign } from 'src/utils/watch'
import RiskCard from 'pages/Sign/RiskCard.vue'
import { siteLabels } from 'src/utils/phishing'
import type { RiskLabel } from 'src/utils/risk'

// a dApp asks to connect over WalletConnect: which address it may see and ask to sign
export default defineComponent({
    components: { RiskCard },
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    props: {
        proposal: { type: Object as () => WcProposal, required: true }
    },
    data(vm) {
        return {
            gid: vm.proposal.gids[0]!,
            address: '',
            wallets: [] as M.Wallet[],
            siteRisks: [] as RiskLabel[]
        }
    },
    computed: {
        host(): string {
            try {
                return new URL(this.proposal.url).host
            } catch {
                return this.proposal.url
            }
        },
        level(): 'ok' | 'unknown' | 'bad' {
            if (this.proposal.isScam || this.proposal.validation === 'INVALID' || this.siteRisks.some(r => r.level === 'danger')) return 'bad'
            return this.proposal.validation === 'VALID' ? 'ok' : 'unknown'
        },
        addresses(): { label: string, value: string }[] {
            return this.wallets
                .filter(w => w.gid === this.gid && canSign(w))
                .flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        }
    },
    watch: {
        addresses: {
            handler(list: { value: string }[]) {
                if (!list.some(a => a.value === this.address)) this.address = list[0]?.value || ''
            },
            immediate: true
        }
    },
    async created() {
        void siteLabels(this.proposal.url).then(l => { this.siteRisks = l })
        this.wallets = await this.$svc.wallet.all()
    },
    methods: {
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },
        ok() {
            this.$emit('ok', { gid: this.gid, address: this.address })
            this.hide()
        }
    }
})
</script>
<style lang="sass" scoped>
.proposal
  max-width: 440px

.dapp-icon
  background: rgba(255, 255, 255, 0.06)

.title
  font-size: 24px
  margin: 12px 0 2px

.verify
  display: inline-flex
  gap: 4px
  align-items: center
  padding: 2px 10px
  border-radius: 999px
  font-size: 12px
  font-weight: 700
  &--ok
    color: var(--q-primary)
    background: var(--bv-accent-soft)
  &--unknown
    color: $warning
    background: rgba(252, 211, 77, 0.1)
  &--bad
    color: $negative
    background: rgba(248, 113, 113, 0.12)

.can
  padding-left: 18px
  line-height: 1.5
</style>
