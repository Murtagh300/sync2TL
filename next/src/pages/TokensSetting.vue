<template>
    <div class="column fit no-wrap">
        <page-toolbar :title="$t('settings.action_token_list')">
            <q-btn
                flat
                round
                icon="o_add_circle_outline"
                :aria-label="$t('tokens.action_add_custom')"
                @click="addByAddress()"
            />
        </page-toolbar>
        <page-content class="col">
            <div
                v-if="tokens.length>0"
                class="q-pa-md"
            >
                <p class="text-soft q-mb-md">{{$t('tokens.msg_auto')}}</p>
                <div
                    v-if="hidden.length"
                    class="bvm-tile q-pa-md q-mb-md"
                >
                    <div class="text-weight-bold q-mb-sm">{{$t('tokens.label_hidden')}}</div>
                    <div class="row q-gutter-sm">
                        <q-chip
                            v-for="s in hidden"
                            :key="s"
                            removable
                            :label="s"
                            @remove="unhide(s)"
                        />
                    </div>
                </div>
                <q-input
                    v-model="search"
                    class="q-mb-sm"
                    dense
                    outlined
                    clearable
                    :placeholder="$t('tokens.label_search')"
                >
                    <template #prepend>
                        <q-icon name="o_search" />
                    </template>
                </q-input>
                <div class="chips row no-wrap q-mb-md">
                    <q-chip
                        v-for="c in categories"
                        :key="c.key"
                        clickable
                        :outline="category !== c.key"
                        :color="category === c.key ? 'primary' : undefined"
                        :text-color="category === c.key ? 'dark' : undefined"
                        class="q-ml-none"
                        :label="`${$t(`tokenCat.${c.key}`)} · ${c.n}`"
                        @click="category = category === c.key ? '' : c.key"
                    />
                </div>
                <q-list
                    role="group"
                    class="bvm-list"
                >
                    <q-item
                        v-for="item in shown"
                        :key="item.address || item.symbol"
                    >
                        <q-item-section avatar>
                            <token-avatar
                                :spec="item"
                                size="md"
                            />
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label
                                lines="1"
                                class="row no-wrap items-center"
                            >
                                <span class="ellipsis">{{item.symbol}}</span>
                                <q-badge
                                    v-if="item.custom"
                                    outline
                                    color="warning"
                                    class="q-ml-xs"
                                    :label="$t('tokens.badge_custom')"
                                />
                            </q-item-label>
                            <q-item-label
                                caption
                                lines="1"
                            >{{item.name}} · {{$t(`tokenCat.${categoryOf(item)}`)}}</q-item-label>
                        </q-item-section>
                        <q-item-section
                            v-if="item.custom"
                            side
                        >
                            <q-btn
                                flat
                                round
                                dense
                                size="sm"
                                icon="o_delete_outline"
                                :aria-label="$t('tokens.action_remove_custom', { symbol: item.symbol })"
                                @click="remove(item)"
                            />
                        </q-item-section>
                        <q-item-section side>
                            <q-toggle
                                color="primary"
                                v-model="activeSymbols"
                                :val="item.symbol"
                                :aria-label="item.symbol"
                            />
                        </q-item-section>
                    </q-item>
                    <q-item v-if="shown.length === 0">
                        <q-item-section class="text-muted">{{$t('tokens.msg_no_match')}}</q-item-section>
                    </q-item>
                </q-list>

                <!-- just live on BetterSwap: Token Forge graduates and other new tokens, not checked by anyone -->
                <div class="row items-center no-wrap q-mt-xl q-mb-sm">
                    <div class="bvm-label col">{{$t('tokens.label_live')}}</div>
                    <q-btn
                        v-if="!live"
                        flat
                        dense
                        no-caps
                        color="primary"
                        :loading="liveLoading"
                        :label="$t('tokens.action_show_live')"
                        @click="loadLive()"
                    />
                </div>
                <p class="text-caption text-muted">{{$t('tokens.msg_live')}}</p>
                <q-list
                    v-if="live"
                    role="list"
                    class="bvm-list"
                >
                    <q-item
                        v-for="t in liveShown"
                        :key="t.address"
                    >
                        <q-item-section avatar>
                            <token-avatar
                                :spec="asSpec(t)"
                                size="md"
                            />
                        </q-item-section>
                        <q-item-section style="min-width: 0">
                            <q-item-label lines="1">{{t.symbol}}</q-item-label>
                            <q-item-label
                                caption
                                lines="1"
                            >{{t.name}} · {{t.address.slice(0, 6)}}…{{t.address.slice(-4)}}<template v-if="t.website"> · {{host(t.website)}}</template></q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-btn
                                outline
                                dense
                                no-caps
                                color="primary"
                                class="q-px-sm"
                                :label="$t('common.add')"
                                @click="addLive(t)"
                            />
                        </q-item-section>
                    </q-item>
                    <q-item v-if="!liveShown.length">
                        <q-item-section class="text-muted">{{$t('tokens.msg_live_none')}}</q-item-section>
                    </q-item>
                </q-list>
            </div>
            <div
                v-else
                class="fit column flex-center"
            >
                <bv-loader
                    v-if="$asyncComputed.tokens?.updating"
                    class="text-h2"
                />
                <template v-else>
                    <p>{{$t('common.something_wrong')}}</p>
                    <q-btn
                        unelevated
                        color="primary"
                        @click="$asyncComputed.tokens?.update()"
                    >{{$t('nft.action_retry')}}</q-btn>
                </template>
            </div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageContent from 'components/PageContent.vue'
import PageToolbar from 'components/PageToolbar.vue'
import TokenAvatar from 'components/TokenAvatar.vue'
import type { TokenPrefs } from 'src/utils/tokens'
import { TOKEN_CATEGORIES, tokenCategory, type TokenCategory } from 'src/utils/token-meta'
import { addCustomToken, liveTokens, readToken, removeCustomToken, TokenError, type CustomToken } from 'src/utils/custom-tokens'
import { genesises } from 'src/consts'

export default defineComponent({
    components: { PageContent, TokenAvatar, PageToolbar },
    data: () => {
        return {
            activeSymbols: null as string[] | null,
            search: '' as string | null,
            hidden: [] as string[],
            category: '' as TokenCategory | '',
            live: null as CustomToken[] | null,
            liveLoading: false,
            // async computed (see src/shims-async-computed.d.ts)
            tokens: [] as M.TokenSpec[]
        }
    },
    async created() {
        this.hidden = (await this.$svc.config.getJSON<TokenPrefs>('token-prefs', { pinned: [], hidden: [] })).hidden
    },
    methods: {
        categoryOf(t: M.TokenSpec): TokenCategory {
            return tokenCategory(t)
        },
        host(url: string) {
            try {
                return new URL(url).host
            } catch {
                return ''
            }
        },
        asSpec(t: CustomToken): M.TokenSpec {
            return { gid: genesises.main.id, name: t.name, symbol: t.symbol, decimals: t.decimals, address: t.address, iconSrc: t.iconSrc || '', permanent: false, custom: true }
        },
        async unhide(symbol: string) {
            const p = await this.$svc.config.getJSON<TokenPrefs>('token-prefs', { pinned: [], hidden: [] })
            p.hidden = p.hidden.filter(s => s !== symbol)
            await this.$svc.config.setJSON('token-prefs', p)
            this.hidden = p.hidden
        },
        errorText(err: unknown): string {
            const code = err instanceof TokenError ? err.code : ''
            return code ? this.$t(`tokens.err_${code.replace('-', '_')}`) : this.$t('common.something_wrong')
        },
        /** saves, switches it on here too (this page writes the switches when it closes) */
        async add(t: CustomToken) {
            try {
                await addCustomToken(this.$svc, t)
            } catch (err) {
                this.$q.notify({ message: this.errorText(err), color: 'negative' })
                return
            }
            if (this.activeSymbols && !this.activeSymbols.includes(t.symbol)) this.activeSymbols.push(t.symbol)
            this.live = this.live?.filter(x => x.address !== t.address) || null
            void this.$asyncComputed.tokens?.update()
            this.$q.notify({ message: this.$t('tokens.msg_added', { symbol: t.symbol }) })
        },
        confirmAdd(t: CustomToken): Promise<boolean> {
            return new Promise(resolve => {
                this.$q.dialog({
                    title: this.$t('tokens.title_add', { symbol: t.symbol }),
                    message: this.$t('tokens.msg_add_warning', { name: t.name, address: t.address }),
                    cancel: true,
                    ok: { label: this.$t('common.add'), color: 'primary', unelevated: true }
                }).onOk(() => resolve(true)).onCancel(() => resolve(false)).onDismiss(() => resolve(false))
            })
        },
        addByAddress() {
            this.$q.dialog({
                title: this.$t('tokens.action_add_custom'),
                message: this.$t('tokens.msg_add_address'),
                prompt: { model: '', type: 'text', isValid: (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim()) },
                cancel: true
            }).onOk(async (value: string) => {
                let t: CustomToken
                try {
                    t = await readToken(this.$svc.bc(genesises.main.id).thor, value.trim())
                } catch (err) {
                    this.$q.notify({ message: this.errorText(err), color: 'negative' })
                    return
                }
                if (await this.confirmAdd(t)) await this.add(t)
            })
        },
        async addLive(t: CustomToken) {
            if (await this.confirmAdd(t)) await this.add(t)
        },
        async remove(t: M.TokenSpec) {
            await removeCustomToken(this.$svc, t.address)
            if (this.activeSymbols) this.activeSymbols = this.activeSymbols.filter(s => s !== t.symbol)
            void this.$asyncComputed.tokens?.update()
        },
        async loadLive() {
            this.liveLoading = true
            try {
                this.live = await liveTokens(this.$svc)
            } catch {
                this.$q.notify({ message: this.$t('common.something_wrong'), color: 'negative' })
            } finally {
                this.liveLoading = false
            }
        }
    },
    computed: {
        q(): string {
            return (this.search || '').trim().toLowerCase()
        },
        categories(): { key: TokenCategory, n: number }[] {
            return TOKEN_CATEGORIES
                .map(key => ({ key, n: this.tokens.filter(t => tokenCategory(t) === key).length }))
                .filter(c => c.n > 0)
        },
        shown(): M.TokenSpec[] {
            return this.tokens.filter(t =>
                (!this.category || tokenCategory(t) === this.category) &&
                (!this.q || t.symbol.toLowerCase().includes(this.q) || t.name.toLowerCase().includes(this.q)))
        },
        liveShown(): CustomToken[] {
            return (this.live || []).filter(t => !this.q || t.symbol.toLowerCase().includes(this.q) || t.name.toLowerCase().includes(this.q))
        }
    },
    asyncComputed: {
        tokens: {
            async get(): Promise<M.TokenSpec[]> {
                if (!this.activeSymbols) {
                    this.activeSymbols = await this.$svc.config.token.activeSymbols()
                }
                const seen = new Set<string>()
                const all = await this.$svc.config.token.all()
                return all.filter(t => {
                    if (t.permanent || seen.has(t.symbol)) {
                        return false
                    }
                    seen.add(t.symbol)
                    return true
                })
            },
            default: []
        }
    },
    async beforeUnmount() {
        if (this.activeSymbols) {
            await this.$svc.config.token.saveActiveSymbols(this.activeSymbols)
        }
    }
})
</script>
<style lang="sass" scoped>
.chips
  overflow-x: auto
  scrollbar-width: none
</style>
