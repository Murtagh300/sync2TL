<template>
    <div class="column fit no-wrap">
        <page-toolbar :title="$t('settings.action_token_list')" />
        <page-content class="col">
            <div
                v-if="tokens.length>0"
                class="q-pa-md"
            >
                <p class="text-soft q-mb-md">{{$t('tokens.msg_auto')}}</p>
                <q-input
                    v-model="search"
                    class="q-mb-md"
                    dense
                    outlined
                    clearable
                    :placeholder="$t('tokens.label_search')"
                >
                    <template #prepend>
                        <q-icon name="o_search" />
                    </template>
                </q-input>
                <q-list class="bvm-list">
                    <q-item
                        v-for="item in shown"
                        :key="item.symbol"
                    >
                        <q-item-section avatar>
                            <token-avatar
                                :spec="item"
                                size="md"
                            />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label lines="1">{{item.symbol}}</q-item-label>
                            <q-item-label caption>{{item.name}}</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <q-toggle
                                color="primary"
                                v-model="activeSymbols"
                                :val="item.symbol"
                            />
                        </q-item-section>
                    </q-item>
                    <q-item v-if="shown.length === 0">
                        <q-item-section class="text-muted">{{$t('tokens.msg_no_match')}}</q-item-section>
                    </q-item>
                </q-list>
            </div>
            <div
                v-else
                class="fit column flex-center"
            >
                <q-spinner-dots
                    v-if="$asyncComputed.tokens.updating"
                    class="text-h2"
                />
                <template v-else>
                    <p>{{$t('common.something_wrong')}}</p>
                    <q-btn
                        unelevated
                        color="primary"
                        @click="$asyncComputed.tokens.update()"
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

export default defineComponent({
    components: { PageContent, TokenAvatar, PageToolbar },
    data: () => {
        return {
            activeSymbols: null as string[] | null,
            search: '' as string | null,
            // async computed (see src/shims-async-computed.d.ts)
            tokens: [] as M.TokenSpec[]
        }
    },
    computed: {
        shown(): M.TokenSpec[] {
            const q = (this.search || '').trim().toLowerCase()
            return q
                ? this.tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
                : this.tokens
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
