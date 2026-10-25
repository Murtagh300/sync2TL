<template>
    <div class="column fit no-wrap">
        <page-toolbar :title="$t('activities.title')">
            <q-btn
                flat
                round
                icon="o_insights"
                :aria-label="$t('overview.title')"
                @click="$router.push({ name: 'overview' })"
            />
            <q-btn
                flat
                round
                icon="o_file_download"
                :aria-label="$t('export.title')"
                :disable="!built.rows.length"
            >
                <q-menu
                    anchor="bottom right"
                    self="top right"
                >
                    <q-list style="min-width: 200px">
                        <q-item
                            v-close-popup
                            clickable
                            @click="exportRows('csv')"
                        >
                            <q-item-section avatar>
                                <q-icon name="o_table_view" />
                            </q-item-section>
                            <q-item-section>{{$t('export.csv')}}</q-item-section>
                        </q-item>
                        <q-item
                            v-close-popup
                            clickable
                            @click="exportRows('pdf')"
                        >
                            <q-item-section avatar>
                                <q-icon name="o_picture_as_pdf" />
                            </q-item-section>
                            <q-item-section>{{$t('export.pdf')}}</q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
        </page-toolbar>
        <!-- search and filters -->
        <div class="q-px-md q-pt-sm q-pb-xs filters">
            <q-input
                v-model="filter.q"
                dense
                outlined
                clearable
                debounce="200"
                :placeholder="$t('activityFilter.placeholder')"
                @clear="filter.q = ''"
            >
                <template #prepend>
                    <q-icon name="o_search" />
                </template>
            </q-input>
            <div class="row no-wrap q-gutter-x-xs q-mt-xs chips">
                <q-chip
                    v-for="k in (['all', 'in', 'out', 'fail'] as const)"
                    :key="k"
                    clickable
                    dense
                    :outline="filter.kind !== k"
                    :color="filter.kind === k ? 'primary' : undefined"
                    :text-color="filter.kind === k ? 'dark' : undefined"
                    class="q-ma-none q-mr-xs"
                    @click="filter.kind = k"
                >{{$t(`activityFilter.kind_${k}`)}}</q-chip>
                <q-chip
                    clickable
                    dense
                    outline
                    icon="o_event"
                    class="q-ma-none q-mr-xs"
                >
                    {{$t(`activityFilter.period_${filter.period}`)}}
                    <q-menu auto-close>
                        <q-list dense>
                            <q-item
                                v-for="p in (['all', 'month', '30d', 'year'] as const)"
                                :key="p"
                                clickable
                                :active="filter.period === p"
                                @click="filter.period = p"
                            >
                                <q-item-section>{{$t(`activityFilter.period_${p}`)}}</q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-chip>
                <q-chip
                    v-if="tokenOptions.length > 1"
                    clickable
                    dense
                    outline
                    icon="o_toll"
                    class="q-ma-none q-mr-xs"
                >
                    {{filter.token === null ? $t('activityFilter.any_token') : tokenLabel(filter.token)}}
                    <q-menu auto-close>
                        <q-list dense>
                            <q-item
                                clickable
                                :active="filter.token === null"
                                @click="filter.token = null"
                            >
                                <q-item-section>{{$t('activityFilter.any_token')}}</q-item-section>
                            </q-item>
                            <q-item
                                v-for="t in tokenOptions"
                                :key="t"
                                clickable
                                :active="filter.token === t"
                                @click="filter.token = t"
                            >
                                <q-item-section>{{tokenLabel(t)}}</q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-chip>
            </div>
        </div>
        <page-content class="col">
            <pull-refresh
                @refresh="refresh"
            >
                <div
                    v-if="filtered && built.rows.length"
                    class="q-px-md q-pt-sm text-caption text-muted row items-center"
                >
                    {{$t('activityFilter.label_count', { n: shownRows.length, of: built.rows.length })}}
                    <q-space />
                    <q-btn
                        flat
                        dense
                        no-caps
                        size="sm"
                        color="primary"
                        :label="$t('activityFilter.action_clear')"
                        @click="filter = emptyFilter()"
                    />
                </div>
                <template v-if="groups.length">
                    <section
                        v-for="g in groups"
                        :key="g.label"
                    >
                        <div class="bvm-label group-label">{{g.label}}</div>
                        <q-list>
                            <activity-row
                                v-for="r in g.rows"
                                :key="r.key"
                                :row="r"
                                @open="open(r.key)"
                            />
                        </q-list>
                    </section>
                </template>
                <q-list v-else-if="loading">
                    <q-item
                        v-for="i in 5"
                        :key="i"
                    >
                        <q-item-section avatar>
                            <q-skeleton
                                type="rect"
                                width="40px"
                                height="40px"
                            />
                        </q-item-section>
                        <q-item-section>
                            <q-skeleton
                                type="text"
                                width="55%"
                            />
                            <q-skeleton
                                type="text"
                                width="35%"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
                <empty-state
                    v-else-if="filtered"
                    icon="o_search_off"
                    :text="$t('activityFilter.msg_nothing')"
                    :action="$t('activityFilter.action_clear')"
                    @action="filter = emptyFilter()"
                />
                <empty-state
                    v-else
                    icon="o_receipt_long"
                    :text="$t('activities.msg_not_found')"
                    :action="$t('empty.action_home')"
                    action-icon="o_home"
                    @action="$router.push({ name: 'index' })"
                />
            </pull-refresh>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PullRefresh from 'components/PullRefresh.vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import ActivityRow, { type ActivityRow as Row } from './Row.vue'
import { Transaction } from 'thor-devkit'
import { decodeAction } from 'src/utils/actions'
import { describeAction, type ActionText } from 'src/utils/describe-action'
import { formatUnits } from 'src/utils/format'
import { incomingTransfers, type Incoming } from 'src/utils/incoming'
import { txNote } from 'src/utils/tx-notes'
import { emptyFilter, filterRows, isFiltered, type ActivityFilter } from 'src/utils/activity-filter'
import { nameOf } from 'src/utils/names'
import { decodeAsTokenTransferClause, decodeAsNftTransferClause } from 'pages/Sign/helper'
import type { BVM } from 'boot/services/bvm'
import { downloadText, printTable, toCsv, type ExportRow } from 'src/utils/export'
import { prefs } from 'src/utils/prefs'
import { BigNumber } from 'bignumber.js'

const units = (v: bigint | string, decimals: number) => new BigNumber(v.toString()).div(new BigNumber(10).pow(decimals)).toNumber()

type Target =
    | { kind: 'tx', gid: string, txId: string, me: string }
    | { kind: 'cert', message: string }

const ZERO = '0x0000000000000000000000000000000000000000'

// what happened on the wallets, newest first, by day: signed by you and sent to you
export default defineComponent({
    components: { EmptyState, PullRefresh, PageToolbar, PageContent, ActivityRow },
    data: () => ({
        loading: true,
        list: [] as M.Activity[],
        incoming: [] as (Incoming & { gid: string })[],
        tokens: [] as M.TokenSpec[],
        collections: {} as Record<string, BVM.Collection>,
        filter: emptyFilter() as ActivityFilter
    }),
    computed: {
        built(): { rows: Row[], targets: Record<string, Target> } {
            const targets: Record<string, Target> = {}
            const rows: Row[] = []
            const ownTx = new Set<string>()
            for (const a of this.list) {
                if (a.type === 'tx') {
                    const row = this.txRow(a)
                    rows.push(row)
                    ownTx.add(a.glob.id.toLowerCase())
                    targets[row.key] = { kind: 'tx', gid: a.gid, txId: a.glob.id, me: a.glob.signer }
                } else {
                    const row = this.certRow(a)
                    rows.push(row)
                    targets[row.key] = { kind: 'cert', message: (JSON.parse(a.glob.encoded) as Connex.Vendor.CertMessage).payload.content }
                }
            }
            for (const i of this.incoming) {
                if (ownTx.has(i.txId.toLowerCase())) continue
                // tokens outside the registry are mostly airdropped spam: left out, like spam NFTs
                if (i.kind === 'token' && !this.token(i.gid, i.contract)) continue
                const row = this.incomingRow(i)
                rows.push(row)
                targets[row.key] = { kind: 'tx', gid: i.gid, txId: i.txId, me: i.to }
            }
            return { rows: rows.sort((a, b) => b.time - a.time), targets }
        },
        filtered(): boolean {
            return isFiltered(this.filter)
        },
        shownRows(): Row[] {
            return filterRows(this.built.rows, this.filter, nameOf)
        },
        /** the tokens that occur, for the token filter */
        tokenOptions(): string[] {
            return [...new Set(this.built.rows.filter(r => r.asset).map(r => (r.asset!.token || '').toLowerCase()))]
        },
        groups(): { label: string, rows: Row[] }[] {
            const out: { label: string, rows: Row[] }[] = []
            for (const r of this.shownRows) {
                const label = this.groupLabel(r.time)
                const last = out[out.length - 1]
                if (last && last.label === label) {
                    last.rows.push(r)
                } else {
                    out.push({ label, rows: [r] })
                }
            }
            return out
        }
    },
    created() {
        void this.load()
    },
    methods: {
        emptyFilter,
        tokenLabel(address: string): string {
            if (!address || address === ZERO) return 'VET'
            return this.tokens.find(t => (t.address || '').toLowerCase() === address)?.symbol || `${address.slice(0, 6)}…`
        },
        async load() {
            this.loading = true
            try {
                const [list, wallets, tokens] = await Promise.all([
                    this.$svc.activity.page(100, 0),
                    this.$svc.wallet.all(),
                    this.$svc.config.token.all()
                ])
                this.list = list
                this.tokens = tokens
                this.$svc.bvm.collections().then(c => { this.collections = c }).catch(() => { })
                // what others sent, per network
                const byGid = new Map<string, string[]>()
                for (const w of wallets) {
                    byGid.set(w.gid, [...(byGid.get(w.gid) || []), ...w.meta.addresses])
                }
                const parts = await Promise.all([...byGid.entries()].map(([gid, addresses]) =>
                    incomingTransfers(this.$svc.bc(gid).thor, addresses, 40)
                        .then(items => items.map(i => ({ ...i, gid })))
                        .catch(() => [] as (Incoming & { gid: string })[])))
                this.incoming = parts.flat()
            } finally {
                this.loading = false
            }
        },
        async exportRows(kind: 'csv' | 'pdf') {
            const rows = this.built.rows
            // values at the time: hourly prices reach back 30 days
            const tokens = [...new Set(rows.filter(r => r.asset).map(r => r.asset!.token))]
            const [history, fx] = await Promise.all([
                this.$svc.prices.history(tokens, 720).catch(() => ({} as Record<string, { time: number, price: number }[]>)),
                this.$svc.prices.fx(prefs.currency)
            ])
            const priceAt = (token: string, t: number) => {
                const pts = history[(token || ZERO).toLowerCase()] || []
                if (!pts.length || t < pts[0]!.time - 3600 * 1000) return null
                let p = pts[0]!.price
                for (const x of pts) {
                    if (x.time > t) break
                    p = x.price
                }
                return p
            }
            const out: ExportRow[] = rows.map(r => {
                const price = r.asset ? priceAt(r.asset.token, r.time) : null
                return {
                    time: r.time,
                    type: r.tone === 'in' ? this.$t('export.type_in') : r.tone === 'out' ? this.$t('export.type_out') : r.tone === 'fail' ? this.$t('export.type_failed') : this.$t('export.type_other'),
                    title: r.title,
                    amount: r.amount || '',
                    counterparty: r.counterparty || '',
                    txId: r.txId || '',
                    note: r.note || '',
                    value: price !== null && r.asset ? (r.asset.amount * price * fx).toFixed(2) : ''
                }
            })
            const headers = [
                this.$t('export.col_date'), this.$t('export.col_type'), this.$t('export.col_what'), this.$t('export.col_amount'),
                this.$t('export.col_counterparty'), this.$t('export.col_tx'), this.$t('export.col_note'),
                this.$t('export.col_value', { currency: prefs.currency })
            ]
            if (kind === 'csv') {
                downloadText(`blackvault-activity-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(out, headers))
            } else if (!printTable(this.$t('export.title_pdf'), out, headers)) {
                this.$q.notify(this.$t('export.msg_popup'))
            }
        },
        refresh(done: () => void) {
            void this.load().finally(done)
        },
        open(key: string) {
            const t = this.built.targets[key]
            if (!t) {
                return
            }
            if (t.kind === 'tx') {
                void this.$router.push({ name: 'tx', params: { gid: t.gid, txId: t.txId }, query: { me: t.me } })
            } else {
                this.$q.dialog({ title: this.$t('activities.title_signed_content'), message: t.message, ok: false })
            }
        },
        token(gid: string, address: string | undefined): M.TokenSpec | undefined {
            const a = (address || ZERO).toLowerCase()
            return this.tokens.find(t => t.gid === gid && (t.address || ZERO).toLowerCase() === a)
        },
        describe(gid: string, action: NonNullable<ReturnType<typeof decodeAction>>): ActionText {
            return describeAction(action, {
                t: (key, params) => this.$t(key, params ?? {}),
                token: address => this.token(gid, address),
                collection: address => this.collections[address.toLowerCase()]?.name
            })
        },
        groupLabel(time: number): string {
            const day = 24 * 3600 * 1000
            const start = new Date()
            start.setHours(0, 0, 0, 0)
            const rtf = new Intl.RelativeTimeFormat(this.$i18n.locale, { numeric: 'auto' })
            const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
            if (time >= start.getTime()) return cap(rtf.format(0, 'day'))
            if (time >= start.getTime() - day) return cap(rtf.format(-1, 'day'))
            if (time >= start.getTime() - 6 * day) return this.$t('activities.label_this_week')
            return cap(new Date(time).toLocaleDateString(this.$i18n.locale, { month: 'long', year: 'numeric' }))
        },
        status(a: M.Activity): Row['status'] {
            if (a.type !== 'tx') return undefined
            const receipt = a.glob.receipt
            if (receipt?.reverted) return 'failed'
            if (!receipt) return a.status === 'completed' ? 'expired' : 'pending'
            return undefined
        },
        txRow(a: M.Activity): Row {
            if (a.type !== 'tx') throw new Error('not a tx')
            const status = this.status(a)
            const failed = status === 'failed' || status === 'expired'
            const base: Row = {
                key: `tx:${a.id}`,
                txId: a.glob.id,
                time: a.createdTime,
                title: a.glob.comment || this.$t('common.transaction'),
                icon: 'o_receipt_long',
                tone: failed ? 'fail' : 'neutral',
                note: txNote(a.glob.id),
                status,
                statusLabel: status ? this.$t(`activities.status_${status}`) : undefined
            }
            const out = failed ? 'fail' : 'out'
            try {
                const tx = Transaction.decode(Buffer.from(a.glob.encoded.slice(2), 'hex'))
                const [c] = tx.body.clauses
                if (!c) return base
                const clause = { to: c.to, value: String(c.value), data: c.data }
                // a plain payment: what and to whom
                if (tx.body.clauses.length === 1 && (!c.data || c.data === '0x') && BigInt(c.value) > 0n) {
                    const amount = formatUnits(BigInt(c.value), 18)
                    return {
                        ...base,
                        asset: { amount: -units(BigInt(c.value), 18), token: '' },
                        icon: 'o_north_east',
                        tone: out,
                        amount: `−${amount} VET`,
                        counterparty: c.to || undefined,
                        counterpartyLabel: this.$t('activities.label_to'),
                        title: a.glob.comment || this.$t('activities.label_sent_vet', { amount })
                    }
                }
                for (const spec of this.tokens.filter(t => t.gid === a.gid)) {
                    const t = decodeAsTokenTransferClause(clause, spec)
                    if (t) {
                        return { ...base, icon: 'o_north_east', tone: out, amount: `−${formatUnits(t.amount, spec.decimals)} ${spec.symbol}`, counterparty: t.to, counterpartyLabel: this.$t('activities.label_to'), asset: { amount: -units(t.amount, spec.decimals), token: spec.address } }
                    }
                }
                const nft = decodeAsNftTransferClause(clause)
                if (nft) {
                    return { ...base, icon: 'o_image', tone: out, counterparty: nft.to, counterpartyLabel: this.$t('activities.label_to') }
                }
                for (const cl of tx.body.clauses) {
                    const action = decodeAction({ to: cl.to, value: cl.value, data: cl.data })
                    if (action) {
                        const d = this.describe(a.gid, action)
                        return { ...base, icon: d.icon, title: a.glob.comment || d.text }
                    }
                }
            } catch {
                // undecodable: the plain row
            }
            if (!a.glob.comment && a.glob.origin) {
                try {
                    return { ...base, title: this.$t('activities.label_from_dapp', { host: new URL(a.glob.origin).host }) }
                } catch { }
            }
            return base
        },
        certRow(a: M.Activity): Row {
            const cert = JSON.parse(a.glob.encoded) as Connex.Vendor.CertMessage
            return {
                key: `cert:${a.id}`,
                time: a.createdTime,
                title: cert.purpose === 'identification' ? this.$t('common.identification') : this.$t('common.agreement'),
                icon: cert.purpose === 'identification' ? 'o_login' : 'o_draw',
                tone: 'neutral'
            }
        },
        incomingRow(i: Incoming & { gid: string }): Row {
            const base: Row = {
                key: `in:${i.id}`,
                txId: i.txId,
                time: i.time,
                title: '',
                icon: 'o_south_west',
                tone: 'in',
                counterparty: i.from,
                counterpartyLabel: this.$t('activities.label_from'),
                note: txNote(i.txId)
            }
            if (i.kind === 'vet') {
                return { ...base, title: this.$t('activities.label_received', { what: 'VET' }), amount: `+${formatUnits(BigInt(i.amount || 0), 18)} VET`, asset: { amount: units(i.amount || '0', 18), token: '' } }
            }
            if (i.kind === 'nft') {
                const name = this.collections[i.contract!]?.name || this.$t('action.an_nft')
                return { ...base, icon: 'o_image', title: this.$t('activities.label_received', { what: `${name} #${i.tokenId}` }), amount: '+1 NFT' }
            }
            const spec = this.token(i.gid, i.contract)
            return {
                ...base,
                title: this.$t('activities.label_received', { what: spec?.symbol || this.$t('activities.label_a_token') }),
                amount: spec ? `+${formatUnits(BigInt(i.amount || 0), spec.decimals)} ${spec.symbol}` : undefined,
                asset: spec ? { amount: units(i.amount || '0', spec.decimals), token: spec.address } : undefined
            }
        }
    }
})
</script>
<style lang="sass" scoped>
.filters
  border-bottom: 1px solid $hairline

.chips
  overflow-x: auto
  scrollbar-width: none

.group-label
  padding: 16px 16px 4px
</style>
