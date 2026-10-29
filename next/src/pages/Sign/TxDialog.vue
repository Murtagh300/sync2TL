<template>
    <q-dialog
        ref="dialog"
        @hide="$emit('hide')"
        maximized
        transition-show="slide-up"
        transition-hide="slide-down"
    >
        <q-card class="column no-wrap">
            <page-toolbar
                :title="$t('common.transaction')"
                icon="close"
                :gid="gid"
                @action="hide()"
            />
            <!-- one flow: what happens, then the warnings, fee and signer right under it -->
            <page-content
                class="q-pa-sm bg-page"
                innerClass="q-gutter-y-sm"
            >
                <div
                    v-if="originHost"
                    class="bvm-tile origin row no-wrap items-center"
                >
                    <q-icon
                        name="o_public"
                        size="18px"
                        class="q-mr-sm"
                    />
                    <span class="ellipsis">{{$t('sign.label_from_site', { host: originHost })}}</span>
                </div>
                <risk-card :labels="risks" />
                <simulation-card
                    v-if="changes"
                    :changes="changes"
                    :gid="gid"
                    :tokens="tokens"
                    :collections="collections"
                />
                <clause-card
                    v-for="(c, i) in req.message"
                    :key="i"
                    :index="i"
                    :clause="c"
                    :tokens="tokens"
                    :collections="collections"
                    @click="onClickClause(i, c)"
                />
            </page-content>
            <page-content
                size="xs"
                class="col"
            >
                <error-tip
                    v-if="criticalError"
                    :error="criticalError"
                />
                <template v-else>
                    <!-- short of VTHO: say how much, and get it in one tap -->
                    <div
                        v-if="vthoShort"
                        class="bvm-tile vtho-short row no-wrap items-center q-mb-sm"
                    >
                        <q-icon
                            name="o_local_gas_station"
                            color="warning"
                            size="22px"
                        />
                        <div class="col q-mx-sm">
                            <div class="text-weight-bold">{{$t('sign.title_vtho_short')}}</div>
                            <div class="text-muted">{{$t('sign.msg_vtho_short', vthoShort)}}</div>
                        </div>
                        <!-- no VTHO needed at all: VeChain's delegator takes the fee in VET -->
                        <q-btn
                            v-if="feeTokens"
                            unelevated
                            dense
                            no-caps
                            color="primary"
                            class="q-px-sm q-mr-xs"
                            :label="$t('sign.action_pay_in_vet')"
                            @click="feeToken = 'vet'"
                        />
                        <q-btn
                            v-if="!isDelegation"
                            outline
                            dense
                            no-caps
                            color="primary"
                            class="q-px-sm"
                            :label="$t('sign.action_get_vtho')"
                            @click="getVtho()"
                        />
                    </div>
                    <!-- paying in VET or B3TR, and the address has too little of it -->
                    <div
                        v-if="tokenShort"
                        class="bvm-tile vtho-short row no-wrap items-center q-mb-sm"
                    >
                        <q-icon
                            name="o_local_gas_station"
                            color="warning"
                            size="22px"
                        />
                        <div class="col q-mx-sm">
                            <div class="text-weight-bold">{{$t('sign.title_token_short', { symbol: tokenShort.symbol })}}</div>
                            <div class="text-muted">{{$t('sign.msg_token_short', tokenShort)}}</div>
                        </div>
                    </div>
                    <div
                        v-if="feeQuoteFailed"
                        class="text-negative q-px-md q-mb-sm fee-note"
                    >{{$t('sign.msg_fee_quote_failed')}}</div>
                    <!-- short of VTHO is said above already: the general warning only for anything else -->
                    <error-tip
                        v-if="warnings.length > (energyWarning ? 1 : 0)"
                        type="warning"
                        :error="{name: $t('sign.label_transaction_warning'), message: ''}"
                        clickable
                        @click="showWarnings()"
                    />

                    <gas-fee-bar
                        :fee="fee ?? undefined"
                        :isDelegation="isDelegation"
                        :tokenFee="tokenFee"
                    >
                        <priority-selector
                            v-if="payToken === 'vtho'"
                            v-model:coef="gasPriceCoef"
                            :calcFee="calcFee"
                        />
                    </gas-fee-bar>
                    <!-- the fee in VTHO, or in VET or B3TR through VeChain's delegator (mainnet) -->
                    <div
                        v-if="feeTokens"
                        class="row no-wrap items-center q-px-md q-mb-sm"
                    >
                        <div class="text-muted fee-note q-mr-sm">{{$t('sign.label_pay_fee_in')}}</div>
                        <q-btn-toggle
                            v-model="feeToken"
                            class="col fee-toggle"
                            spread
                            dense
                            no-caps
                            unelevated
                            color="transparent"
                            text-color="grey-5"
                            toggle-color="primary"
                            toggle-text-color="dark"
                            :options="[{ value: 'vtho', label: 'VTHO' }, { value: 'vet', label: 'VET' }, { value: 'b3tr', label: 'B3TR' }]"
                        />
                    </div>
                    <signer-selector
                        :signer="signer"
                        :groups="signerGroups"
                        @select="signer=$event"
                    />
                </template>
            </page-content>
            <page-action class="q-mt-md">
                <q-btn
                    v-if="criticalError"
                    outline
                    color="primary"
                    :label="$t('common.close')"
                    @click="hide()"
                />
                <q-btn
                    v-else
                    unelevated
                    color="primary"
                    :label="$t('sign.action_sign')"
                    @click="onClickSign()"
                    :loading="thor.status.head.number === 0"
                />
            </page-action>
        </q-card>
    </q-dialog>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Common from './Common'
import { QDialog } from 'quasar'
import PageToolbar from 'src/components/PageToolbar.vue'
import PageContent from 'src/components/PageContent.vue'
import PageAction from 'src/components/PageAction.vue'
import SignerSelector from './SignerSelector.vue'
import { estimateGas, EstimateGasResult, calcFee, decodeAsTokenTransferClause } from './helper'
import PrioritySelector from './PrioritySelector.vue'
import GasFeeBar from './GasFeeBar.vue'
import ClauseCard from './ClauseCard'
import { Transaction } from 'thor-devkit'
import { BigNumber } from 'bignumber.js'
import { randomBytes } from 'crypto'
import ErrorTip from './ErrorTip.vue'
import WarningListDialog from './WarningListDialog.vue'
import InspectClauseDialog from './InspectClauseDialog.vue'
import { haptic, money, prefs } from 'src/utils/prefs'
import { outgoingValue } from 'src/utils/spend-limit'
import SpendLimitDialog from './SpendLimitDialog.vue'
import { genesises } from 'src/consts'
import { network } from 'src/utils/network'
import SimulationCard from './SimulationCard.vue'
import { balanceChanges, type BalanceChanges } from 'src/utils/simulate'
import type { BVM } from 'boot/services/bvm'
import { B3TR } from 'src/utils/ecosystem'
import { delegate, depositAccount, maxFeeWei, quoteFee, verifyDelegated, type FeeQuote, type FeeToken } from 'src/utils/fee-token'
import vetIcon from 'src/assets/vet.svg'
import RiskCard from './RiskCard.vue'
import { ageInDays, contractBornAt, riskLabels, usedContracts, type RiskLabel } from 'src/utils/risk'
import { siteLabels } from 'src/utils/phishing'
import { contractName, isKnownSwapRouter } from 'src/utils/actions'

const level = (l: RiskLabel['level']) => l === 'danger' ? 2 : l === 'warn' ? 1 : 0

export default defineComponent({
    extends: Common,
    // the Dialog plugin listens to these
    emits: ['ok', 'hide'],
    components: { PageToolbar, PageContent, PageAction, SignerSelector, PrioritySelector, GasFeeBar, ClauseCard, ErrorTip, SimulationCard, RiskCard },
    props: {
        req: { type: Object as () => M.TxRequest, required: true }
    },
    data() {
        return {
            gasPriceCoef: 0,
            network,
            // async computed (see src/shims-async-computed.d.ts)
            delayedEstimation: null as EstimateGasResult | null,
            tokens: [] as M.TokenSpec[],
            energy: null as { balance: string, fee: string } | null,
            collections: {} as Record<string, BVM.Collection>,
            /** what pays the fee; VET and B3TR go through VeChain's delegator */
            feeToken: (prefs.feeToken || 'vtho') as FeeToken,
            feeQuote: null as FeeQuote | null,
            feeQuoteFailed: false,
            /** the signer's VET or B3TR (wei), for the fee token */
            tokenBalance: null as bigint | null,
            /** the clauses' targets that are contracts, with their age in days (null: unknown) */
            contracts: {} as Record<string, number | null>,
            usedBefore: new Set<string>(),
            /** what is known about the site that asks: a phishing list, a borrowed name */
            siteRisks: [] as RiskLabel[]
        }
    },
    computed: {
        calcFee() {
            const est = this.estimation
            if (!est) {
                return null
            }
            return (coef: number) => {
                return calcFee(est.gas, est.baseGasPrice, coef).toString()
            }
        },
        fee(): string | null {
            return this.calcFee ? this.calcFee(this.gasPriceCoef) : null
        },
        criticalError(): Error | null {
            if (!this.network.online) {
                return { name: this.$t('offline.title').toString(), message: this.$t('offline.msg_sign').toString() }
            }
            if (!this.wallet) {
                return { name: this.$t('sign.label_critical_error').toString(), message: this.signerGroups.length > 0 ? this.$t('sign.msg_address_not_owned').toString() : this.$t('common.no_wallet').toString() }
            }
            // test vip191 feature bit when delegator set
            const head = this.thor.status.head
            if (head.number > 0 && this.req.options.delegator && !((head.txsFeatures || 0) & 1)) {
                return { name: this.$t('sign.label_critical_error').toString(), message: this.$t('sign.msg_vip191_not_supported').toString() }
            }
            return null
        },
        warnings(): Error[] {
            const ret: Error[] = []
            if (this.estimation) {
                const { reverted, vmError, revertReason } = this.estimation
                if (reverted) {
                    ret.push({
                        name: this.$t('sign.label_vm_error').toString(),
                        message: revertReason ? `${vmError} (${revertReason})` : `${vmError}`
                    })
                }
            }
            this.energyWarning && ret.push(this.energyWarning)
            return ret
        },
        energyWarning(): Error | null {
            return this.vthoShort
                ? { name: this.$t('sign.label_insufficient_vtho').toString(), message: this.$t('sign.msg_insufficient_vtho').toString() }
                : null
        },
        /** the fee and what the gas payer has, in VTHO, when it isn't enough */
        vthoShort(): { need: string, have: string } | null {
            const e = this.energy
            if (!e || new BigNumber(e.balance).isGreaterThanOrEqualTo(e.fee)) {
                return null
            }
            const vtho = (wei: string) => BigNumber.max(new BigNumber(wei), 0).div(1e18).toFormat(2)
            return { need: vtho(e.fee), have: vtho(e.balance) }
        },
        /** what signing does to the signer's balances; none when the dry run fails */
        changes(): BalanceChanges | null {
            const est = this.estimation
            if (!est || est.reverted) {
                return null
            }
            return balanceChanges(est.outputs, this.signer)
        },
        isDelegation(): boolean {
            return !!this.req.options.delegator
        },
        /** VET and B3TR can pay the fee: on mainnet, when the dApp doesn't pay it already */
        feeTokens(): boolean {
            return this.gid === genesises.main.id && !this.isDelegation
        },
        /** the token that actually pays: VTHO wherever the delegator can't be used */
        payToken(): FeeToken {
            return this.feeTokens ? this.feeToken : 'vtho'
        },
        tokenFee(): { symbol: 'VET' | 'B3TR', icon: string, cost: number } | null {
            const t = this.payToken
            if (t === 'vtho') return null
            const q = this.feeQuote && this.feeQuote.token === t ? this.feeQuote : null
            const icon = t === 'vet' ? vetIcon : (this.tokens.find(x => (x.address || '').toLowerCase() === B3TR)?.iconSrc || '')
            return { symbol: t === 'vet' ? 'VET' : 'B3TR', icon, cost: q ? q.cost : 0 }
        },
        /** VET or B3TR the transaction itself sends, which the fee comes on top of (wei) */
        tokenOut(): bigint {
            if (this.payToken === 'vet') {
                return this.req.message.reduce((sum, c) => sum + BigInt(new BigNumber(c.value || 0).toFixed(0)), 0n)
            }
            const spec = this.tokens.find(x => (x.address || '').toLowerCase() === B3TR)
            if (!spec) return 0n
            return this.req.message.reduce((sum, c) => {
                const r = decodeAsTokenTransferClause(c, spec)
                return sum + (r ? BigInt(r.amount) : 0n)
            }, 0n)
        },
        /** the fee token, and the address has less than the fee plus what is sent */
        tokenShort(): { symbol: string, need: string, have: string } | null {
            const f = this.tokenFee
            const bal = this.tokenBalance
            if (!f || !f.cost || bal === null) return null
            const need = this.tokenOut + BigInt(Math.ceil(f.cost * 1e9)) * 10n ** 9n
            if (bal >= need) return null
            const fmt = (wei: bigint) => new BigNumber(wei.toString()).div(1e18).toFormat(2)
            return { symbol: f.symbol, need: fmt(need), have: fmt(bal) }
        },
        risks(): RiskLabel[] {
            const tokens = new Set(this.tokens.map(t => (t.address || '').toLowerCase()))
            const known = (a: string) => !!contractName(a) || isKnownSwapRouter(a) || tokens.has(a) || !!this.collections[a]
            return [...this.siteRisks, ...riskLabels({
                clauses: this.req.message,
                changes: this.changes,
                known,
                isToken: a => tokens.has(a),
                contracts: this.contracts,
                used: this.usedBefore
            })].sort((a, b) => level(b.level) - level(a.level))
        },
        /** what a fee quote depends on */
        feeInputs(): string {
            return [this.payToken, this.signer, this.estimation ? this.estimation.gas : 0].join('|')
        },
        thor(): Connex.Thor { return this.$svc.bc(this.gid).thor },
        /** the site that asks (a dApp, over WalletConnect or a link) */
        originHost(): string {
            try {
                return this.req.origin ? new URL(this.req.origin).host : ''
            } catch {
                return ''
            }
        },
        estimation(): EstimateGasResult | null {
            if (this.delayedEstimation && this.delayedEstimation.caller === this.signer) {
                return this.delayedEstimation
            }
            return null
        }
    },
    asyncComputed: {
        // the result may not match the current signer
        delayedEstimation(): Promise<EstimateGasResult | null> {
            if (!this.wallet) {
                return Promise.resolve(null)
            }
            return estimateGas(
                this.thor,
                this.req.message,
                this.req.options.gas || 0,
                this.signer,
                this.req.options.delegator && this.req.options.delegator.signer)
        },
        collections: {
            async get(): Promise<Record<string, BVM.Collection>> {
                if (!this.$svc.bvm.supports(this.gid)) {
                    return {}
                }
                try {
                    return await this.$svc.bvm.collections()
                } catch {
                    return {}
                }
            },
            default: {}
        },
        tokens: {
            async get(): Promise<M.TokenSpec[]> {
                const all = await this.$svc.config.token.all()
                return all.filter(spec => spec.gid === this.gid)
            },
            default: []
        },
        /** the gas payer's VTHO (less what this transaction sends) and the fee */
        async energy(): Promise<{ balance: string, fee: string } | null> {
            const est = this.estimation
            const fee = this.fee
            if (!est || !fee || (this.req.options.delegator && !this.req.options.delegator.signer) || this.payToken !== 'vtho') {
                return null
            }
            const signer = this.signer
            const gasPayer = (this.req.options.delegator && this.req.options.delegator.signer) || signer
            const acc = await this.thor.account(gasPayer).get()

            let energyBalance = new BigNumber(acc.energy)

            if (gasPayer === signer) {
                // in the case signer is the gas payer, we deduct the balance with VTHO out amount
                const vthoSpec = (this.tokens || []).find(t => t.symbol === 'VTHO')
                if (vthoSpec) {
                    for (const c of this.req.message) {
                        const r = decodeAsTokenTransferClause(c, vthoSpec)
                        if (r) {
                            energyBalance = energyBalance.minus(r.amount)
                        }
                    }
                }
            }
            return { balance: energyBalance.toFixed(0), fee }
        }
    },
    watch: {
        // which targets are contracts, how old, and whether this signer used them before
        signer: {
            async handler(signer: string) {
                if (!signer) return
                try {
                    const list = await this.$svc.activity.page(500, 0)
                    this.usedBefore = usedContracts(list, signer)
                } catch { }
            },
            immediate: true
        },
        feeToken(t: FeeToken) {
            prefs.feeToken = t
        },
        // a new quote and balance for each token, signer and estimate
        feeInputs: {
            async handler() {
                const t = this.payToken
                const est = this.estimation
                this.feeQuoteFailed = false
                this.tokenBalance = null
                if (t === 'vtho' || !est) {
                    this.feeQuote = null
                    return
                }
                const signer = this.signer
                try {
                    const [quote, balance] = await Promise.all([
                        quoteFee(t, signer, this.req.message),
                        this.balanceOf(t, signer)
                    ])
                    // still the same question
                    if (this.payToken === t && this.signer === signer) {
                        this.feeQuote = quote
                        this.tokenBalance = balance
                    }
                } catch {
                    if (this.payToken === t) {
                        this.feeQuote = null
                        this.feeQuoteFailed = true
                    }
                }
            },
            immediate: true
        }
    },
    async created() {
        void siteLabels(this.req.origin).then(l => { this.siteRisks = l })
        const targets = [...new Set(this.req.message.map(c => (c.to || '').toLowerCase()).filter(Boolean))]
        try {
            const head = this.thor.status.head.number || (await this.thor.block().get())?.number || 0
            const nodeUrl = this.$svc.bc(this.gid).nodeUrl
            const found: Record<string, number | null> = {}
            await Promise.all(targets.map(async to => {
                const acc = await this.thor.account(to).get()
                if (!acc.hasCode) return
                found[to] = null
                // only what the wallet doesn't know is worth the search
                if (contractName(to) || isKnownSwapRouter(to)) return
                try {
                    const born = await contractBornAt(nodeUrl, to, head)
                    found[to] = born === null ? null : ageInDays(born, head)
                } catch { }
            }))
            this.contracts = found
        } catch {
            // offline: no labels
        }
    },
    methods: {
        async balanceOf(t: Exclude<FeeToken, 'vtho'>, who: string): Promise<bigint> {
            if (t === 'vet') {
                return BigInt((await this.thor.account(who).get()).balance)
            }
            const out = await this.thor.account(B3TR).method({
                type: 'function', name: 'balanceOf', constant: true, payable: false, stateMutability: 'view',
                inputs: [{ type: 'address', name: 'owner' }], outputs: [{ type: 'uint256', name: 'balance' }]
            }).call(who)
            return BigInt((out.decoded as { balance?: string }).balance || 0)
        },
        /** to the swap page, VET to VTHO for this address (the transaction is dropped) */
        getVtho() {
            const w = this.wallet
            if (!w) {
                return
            }
            this.hide()
            void this.$router.push({
                name: 'swap',
                query: { wid: String(w.id), i: String(w.meta.addresses.indexOf(this.signer)), from: 'VET', to: 'VTHO' }
            })
        },
        // method is REQUIRED by $q.dialog
        show() { (this.$refs.dialog as QDialog).show() },
        // method is REQUIRED by $q.dialog
        hide() { (this.$refs.dialog as QDialog).hide() },

        ok(result: M.TxResponse) {
            this.saveLastSigner()
            this.$emit('ok', result)
            this.hide()
        },
        showWarnings() {
            this.$dialog({
                component: WarningListDialog,
                warnings: this.warnings,
                noAction: true
            }).catch(() => { })
        },
        async onClickSign() {
            const est = this.estimation
            const wallet = this.wallet
            const signer = this.signer

            if (!est || !wallet) {
                return
            }
            haptic()

            // over the spending limit: wait a moment first
            if (prefs.spendLimit > 0 && this.changes && this.gid === genesises.main.id) {
                try {
                    const tokens = Object.keys(this.changes.tokens)
                    const [stats, fx] = await Promise.all([
                        this.$svc.prices.stats(['0x0000000000000000000000000000000000000000', ...tokens]),
                        this.$svc.prices.fx(prefs.currency)
                    ])
                    const usd = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k.toLowerCase(), v.price]))
                    const decimals = (t: string) => this.tokens.find(x => (x.address || '').toLowerCase() === t.toLowerCase())?.decimals ?? 18
                    const value = outgoingValue(this.changes, usd, decimals, fx)
                    if (value > prefs.spendLimit) {
                        await this.$dialog({ component: SpendLimitDialog, amount: money(value), limit: money(prefs.spendLimit) })
                    }
                } catch {
                    // cancelled in the dialog (prices that can't be had count as nothing, they don't throw)
                    return
                }
            }

            const dangers = this.risks.filter(r => r.level === 'danger')
            if (dangers.length) {
                try {
                    await this.$dialog({
                        component: WarningListDialog,
                        title: this.$t('risk.title_danger').toString(),
                        warnings: dangers.map(r => ({ name: this.$t(`risk.${r.key}`, r.params || {}).toString(), message: '' }))
                    })
                } catch {
                    return
                }
            }

            if (est.reverted) {
                await this.$dialog({
                    component: WarningListDialog,
                    title: this.$t('sign.label_transaction_warning').toString(),
                    warnings: this.warnings
                })
            }

            let tx!: Transaction<Transaction.LegacyBody>
            let delegatorSig: Buffer | undefined

            const originSig = await this.signTx(wallet, signer, () => {
                // compose the tx body
                const txBody: Transaction.LegacyBody = {
                    chainTag: Number.parseInt(this.thor.genesis.id.slice(-2), 16),
                    blockRef: this.thor.status.head.id.slice(0, 18),
                    expiration: 18, // about 3 mins
                    clauses: this.req.message.map(item => {
                        return {
                            to: item.to,
                            value: '0x' + new BigNumber(item.value).toString(16),
                            data: item.data || '0x'
                        }
                    }),
                    gasPriceCoef: this.gasPriceCoef,
                    gas: est.gas,
                    dependsOn: this.req.options.dependsOn || null,
                    nonce: '0x' + randomBytes(8).toString('hex')
                }

                return this.$loading(async () => {
                    const delegator = this.req.options.delegator
                    const payToken = this.payToken
                    if (payToken !== 'vtho') {
                        // VeChain's delegator adds the clause that pays it and signs as gas payer; what
                        // comes back is checked before the user signs it
                        try {
                            const quote = this.feeQuote && this.feeQuote.token === payToken ? this.feeQuote : await quoteFee(payToken, signer, this.req.message)
                            const ours: Transaction.LegacyBody = { ...txBody, reserved: { features: 1 } }
                            const [deposit, signed] = await Promise.all([
                                depositAccount(payToken),
                                delegate(payToken, new Transaction({ ...ours, gas: Math.max(est.gas, quote.gas) }), signer)
                            ])
                            verifyDelegated(ours, signed.tx.body, { token: payToken, deposit, maxFee: maxFeeWei(quote) })
                            tx = new Transaction(signed.tx.body)
                            delegatorSig = signed.signature
                        } catch (err) {
                            this.$q.notify({
                                type: 'negative',
                                message: this.$t('sign.msg_fee_token_failed').toString()
                            })
                            throw err
                        }
                    } else if (delegator) {
                        tx = new Transaction({ ...txBody, reserved: { features: 1 /* VIP191 bit */ } })
                        try {
                            const resp = await this.$axios.post(delegator.url, {
                                raw: '0x' + tx.encode().toString('hex'),
                                origin: signer
                            }, { transformResponse: data => JSON.parse(data), headers: { 'content-type': 'application/json' } })
                            delegatorSig = Buffer.from(resp.data.signature.slice(2), 'hex')
                        } catch (err) {
                            this.$q.notify({
                                type: 'negative',
                                message: this.$t('sign.msg_delegation_failed').toString()
                            })
                            // rethrow to end the process
                            throw err
                        }
                    } else {
                        tx = new Transaction(txBody)
                    }
                    return tx
                })
            })

            tx.signature = delegatorSig ? Buffer.concat([originSig, delegatorSig]) : originSig

            const encoded = '0x' + tx.encode().toString('hex')
            this.$svc.bc(this.gid).commitTx(encoded)

            this.$svc.activity.add({
                gid: this.gid,
                walletId: wallet.id,
                createdTime: Date.now(),
                status: '',
                type: 'tx',
                glob: {
                    id: tx.id!,
                    encoded,
                    signer,
                    comment: this.req.options.comment || '',
                    receipt: null,
                    origin: this.req.origin || '',
                    link: this.req.options.link || ''
                }
            })

            this.ok({
                txid: tx.id!,
                signer
            })
        },
        onClickClause(index: number, clause: Connex.Vendor.TxMessage[0]) {
            this.$dialog({
                component: InspectClauseDialog,
                index,
                clause
            }).catch(() => { })
        }
    }
})
</script>
<style lang="sass" scoped>
.origin
  padding: 8px 12px
  font-size: 13px
  font-weight: 700

.vtho-short
  padding: 10px 12px
  font-size: 13px

.fee-note
  font-size: 13px

.fee-toggle
  border: 1px solid $hairline-2
  border-radius: $radius
  :deep(.q-btn)
    min-height: 32px
    font-weight: 700
</style>
