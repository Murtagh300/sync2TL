<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('validators.title')">
            <q-btn
                flat
                round
                icon="o_refresh"
                :disable="loading"
                :aria-label="$t('validators.action_refresh')"
                @click="load(true)"
            />
        </page-toolbar>
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('validators.msg_intro')}}</p>

            <!-- your NFTs and who they're with -->
            <div
                v-if="mine.length"
                class="bvm-tile q-pa-md q-mb-md"
            >
                <div class="text-weight-bold q-mb-xs">{{$t('validators.label_yours')}}</div>
                <div
                    v-for="m in mine"
                    :key="m.tokenId"
                    class="row no-wrap items-center q-py-xs"
                >
                    <div class="col ellipsis">{{m.level}} <span class="text-muted">#{{m.tokenId}}</span></div>
                    <div class="text-muted text-right">
                        <template v-if="m.validator !== ZERO">
                            {{short(m.validator)}}<span v-if="byAddress[m.validator]?.perWeek"> · {{weekText(byAddress[m.validator]!.perWeek!)}}</span>
                        </template>
                        <template v-else>{{$t('validators.label_none')}}</template>
                        <span
                            v-if="m.exitRequested"
                            class="text-warning"
                        > · {{$t('validators.label_leaving')}}</span>
                    </div>
                </div>
            </div>

            <div class="row q-gutter-sm q-mb-sm items-center">
                <q-chip
                    v-for="s in sorts"
                    :key="s.key"
                    clickable
                    :outline="s.key !== sort"
                    :color="s.key === sort ? 'primary' : undefined"
                    :text-color="s.key === sort ? 'dark' : undefined"
                    @click="sort = s.key"
                >{{s.label}}</q-chip>
                <q-toggle
                    v-model="onlineOnly"
                    dense
                    color="primary"
                    :label="$t('validators.label_online_only')"
                />
            </div>

            <div
                v-if="loading"
                class="column q-gutter-y-sm"
            >
                <div class="text-muted text-caption">{{$t('validators.msg_loading')}}</div>
                <q-skeleton
                    v-for="i in 5"
                    :key="i"
                    height="56px"
                />
            </div>
            <empty-state
                v-else-if="error"
                icon="o_cloud_off"
                :text="$t('common.something_wrong')"
                :action="$t('nft.action_retry')"
                @action="load(true)"
            />
            <q-list
                v-else
                class="bvm-list"
            >
                <q-item
                    v-for="(v, i) in shown"
                    :key="v.address"
                    :clickable="!!movable.length"
                    @click="choose(v)"
                >
                    <q-item-section
                        avatar
                        class="rank text-muted"
                    >{{i + 1}}</q-item-section>
                    <q-item-section style="min-width: 0">
                        <q-item-label class="text-weight-bold ellipsis">
                            <address-label :addr="v.address" />
                            <q-badge
                                v-if="mineAt.has(v.address)"
                                color="primary"
                                text-color="dark"
                                class="q-ml-xs"
                            >{{$t('validators.label_yours_badge')}}</q-badge>
                        </q-item-label>
                        <q-item-label caption>
                            {{$t('validators.label_delegated', { amount: compact(v.delegated) })}} · {{$t('validators.label_periods', { n: v.periods })}}
                            <span
                                v-if="!v.online"
                                class="text-negative"
                            > · {{$t('validators.label_offline')}}</span>
                            <span v-if="v.status === 'queued'"> · {{$t('validators.label_queued')}}</span>
                        </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <div class="text-weight-bold">{{v.perWeek ? weekText(v.perWeek) : '—'}}</div>
                        <div class="text-caption text-muted">{{$t('validators.label_per_week')}}</div>
                    </q-item-section>
                </q-item>
            </q-list>
            <p class="text-caption text-muted q-mt-md">{{$t('validators.msg_estimate')}}</p>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'
import AddressLabel from 'components/AddressLabel.vue'
import { genesises } from 'src/consts'
import { canSign } from 'src/utils/watch'
import { numberLocale } from 'src/utils/format'
import { stakePositions } from 'src/utils/ecosystem'
import { delegationsOf, listValidators, moveClauses, type TokenDelegation, type Validator } from 'src/utils/validators'

const ZERO = '0x0000000000000000000000000000000000000000'

type Mine = TokenDelegation & { level: string, owner: string, canSign: boolean }
type Sort = 'earn' | 'delegated' | 'age'

// StarGate validators side by side, and moving an NFT to another one
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressLabel },
    data: () => ({
        ZERO,
        loading: true,
        error: false,
        list: [] as Validator[],
        mine: [] as Mine[],
        sort: 'earn' as Sort,
        onlineOnly: true
    }),
    computed: {
        sorts(): { key: Sort, label: string }[] {
            return [
                { key: 'earn', label: this.$t('validators.sort_earn') },
                { key: 'delegated', label: this.$t('validators.sort_delegated') },
                { key: 'age', label: this.$t('validators.sort_age') }
            ]
        },
        shown(): Validator[] {
            const by: Record<Sort, (v: Validator) => number> = {
                earn: v => v.perWeek ?? -1,
                delegated: v => v.delegated,
                age: v => v.periods
            }
            return this.list.filter(v => !this.onlineOnly || v.online).sort((a, b) => by[this.sort](b) - by[this.sort](a))
        },
        byAddress(): Record<string, Validator> {
            return Object.fromEntries(this.list.map(v => [v.address, v]))
        },
        mineAt(): Set<string> {
            return new Set(this.mine.map(m => m.validator))
        },
        movable(): Mine[] {
            return this.mine.filter(m => m.canSign)
        }
    },
    async created() {
        await this.load()
    },
    methods: {
        short(a: string) {
            return `${a.slice(0, 6)}…${a.slice(-4)}`
        },
        compact(n: number) {
            return new Intl.NumberFormat(numberLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n)
        },
        weekText(n: number) {
            return `${new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n)} VTHO`
        },
        async load(force = false) {
            this.loading = true
            this.error = false
            const thor = this.$svc.bc(genesises.main.id).thor
            try {
                const wallets = (await this.$svc.wallet.all()).filter(w => w.gid === genesises.main.id)
                const [list, mine] = await Promise.all([
                    listValidators(thor, force),
                    (async () => {
                        const rows: Mine[] = []
                        for (const w of wallets) {
                            for (const a of w.meta.addresses) {
                                const pos = await stakePositions(thor, a)
                                if (!pos.length) continue
                                const d = await delegationsOf(thor, pos.map(p => p.tokenId))
                                rows.push(...d.map((x, k) => ({ ...x, level: pos[k]!.level, owner: a, canSign: canSign(w) })))
                            }
                        }
                        return rows
                    })()
                ])
                this.list = list
                this.mine = mine
            } catch (err) {
                console.warn('validators:', err)
                this.error = true
            } finally {
                this.loading = false
            }
        },
        /** move one of your NFTs to this validator */
        async choose(v: Validator) {
            const options = this.movable.filter(m => m.validator !== v.address)
            if (!options.length) return
            let m = options[0]!
            if (options.length > 1) {
                try {
                    const id = await new Promise<string>((resolve, reject) => {
                        this.$q.dialog({
                            title: this.$t('validators.title_which'),
                            options: { type: 'radio', model: options[0]!.tokenId, items: options.map(o => ({ label: `${o.level} #${o.tokenId}`, value: o.tokenId })) },
                            cancel: true
                        }).onOk((x: string) => resolve(x)).onCancel(() => reject(new Error('cancel')))
                    })
                    m = options.find(o => o.tokenId === id)!
                } catch {
                    return
                }
            }
            const plan = moveClauses(m, v.address)
            if (plan.kind === 'wait') {
                this.$q.notify(this.$t('validators.msg_wait'))
                return
            }
            if (plan.kind === 'exit') {
                try {
                    await new Promise<void>((resolve, reject) => {
                        this.$q.dialog({
                            title: this.$t('validators.title_exit'),
                            message: this.$t('validators.msg_exit'),
                            cancel: true,
                            ok: { label: this.$t('validators.action_exit'), color: 'primary', textColor: 'dark', unelevated: true, noCaps: true }
                        }).onOk(() => resolve()).onCancel(() => reject(new Error('cancel')))
                    })
                } catch {
                    return
                }
            }
            const comment = plan.kind === 'exit'
                ? this.$t('validators.comment_exit', { id: m.tokenId })
                : this.$t('validators.comment_delegate', { id: m.tokenId, to: this.short(v.address) })
            try {
                await this.$signTx(genesises.main.id, {
                    message: plan.clauses.map(c => ({ ...c, comment })),
                    options: { signer: m.owner, comment }
                })
                this.$q.notify(plan.kind === 'exit' ? this.$t('validators.msg_exit_sent') : this.$t('validators.msg_delegated'))
                setTimeout(() => void this.load(), 12 * 1000)
            } catch { }
        }
    }
})
</script>
<style lang="sass" scoped>
.rank
  min-width: 28px
  font-variant-numeric: tabular-nums
</style>
