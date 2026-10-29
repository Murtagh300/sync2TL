<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('helpCenter.title')" />
        <page-content
            class="col"
            padding
        >
            <q-input
                v-model="query"
                outlined
                dense
                clearable
                class="q-mb-md"
                :placeholder="$t('helpCenter.placeholder_search')"
                :aria-label="$t('helpCenter.placeholder_search')"
            >
                <template #prepend>
                    <q-icon name="o_search" />
                </template>
            </q-input>
            <template v-if="articles.length">
                <div class="bvm-label q-pb-sm">{{$t('helpCenter.label_topics')}}</div>
                <q-list
                    role="list"
                    class="bvm-list q-mb-lg"
                >
                    <q-expansion-item
                        v-for="a in articles"
                        :key="a.key"
                        :icon="a.icon"
                        :label="a.title"
                        :model-value="open === a.key"
                        header-class="text-weight-bold"
                        @update:model-value="open = $event ? a.key : ''"
                    >
                        <div class="q-px-md q-pb-md">
                            <p
                                v-for="(para, i) in a.body"
                                :key="i"
                                class="text-soft article-body"
                            >{{para}}</p>
                            <q-btn
                                v-if="a.route"
                                outline
                                dense
                                no-caps
                                color="primary"
                                class="q-px-sm"
                                icon-right="o_chevron_right"
                                :label="$t('helpCenter.action_go')"
                                :to="{ name: a.route }"
                            />
                        </div>
                    </q-expansion-item>
                </q-list>
            </template>
            <template v-if="terms.length">
                <div class="bvm-label q-pb-sm">{{$t('helpCenter.label_terms')}}</div>
                <q-list
                    role="list"
                    class="bvm-list"
                >
                    <q-item
                        v-for="t in terms"
                        :key="t.key"
                    >
                        <q-item-section>
                            <q-item-label class="text-weight-bold">{{t.title}}</q-item-label>
                            <q-item-label
                                caption
                                class="term-body"
                            >{{t.body}}</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </template>
            <empty-state
                v-if="!articles.length && !terms.length"
                icon="o_search_off"
                :text="$t('helpCenter.msg_no_match')"
            />
            <p class="text-caption text-muted q-mt-lg">{{$t('helpCenter.msg_more')}}</p>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import EmptyState from 'components/EmptyState.vue'

/** the topics, each with the page it is about (if any) */
const ARTICLES: { key: string, icon: string, route?: string }[] = [
    { key: 'start', icon: 'o_waving_hand' },
    { key: 'backup', icon: 'o_key', route: 'security' },
    { key: 'scams', icon: 'o_gpp_maybe', route: 'security' },
    { key: 'vtho', icon: 'o_bolt', route: 'vtho-tank' },
    { key: 'fees', icon: 'o_local_gas_station', route: 'settings' },
    { key: 'stargate', icon: 'o_hub', route: 'stargate' },
    { key: 'vebetter', icon: 'o_how_to_vote', route: 'vebetter' },
    { key: 'x2earn', icon: 'o_eco', route: 'discover' },
    { key: 'swap', icon: 'o_swap_vert', route: 'swap' },
    { key: 'nfts', icon: 'o_image', route: 'nfts' },
    { key: 'connect', icon: 'o_link', route: 'dapps' },
    { key: 'lost', icon: 'o_phonelink_erase', route: 'emergency' }
]

const TERMS = ['vtho', 'gas', 'sponsor', 'approval', 'floor', 'vvet', 'recovery', 'slippage', 'vot3']

// short answers to what people ask, and the words the wallet uses; all in the app, offline too
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState },
    props: {
        topic: { type: String, default: '' }
    },
    data() {
        return {
            query: '' as string | null,
            open: this.topic
        }
    },
    computed: {
        q(): string {
            return (this.query || '').trim().toLowerCase()
        },
        articles(): { key: string, icon: string, route?: string, title: string, body: string[] }[] {
            return ARTICLES
                .map(a => ({ ...a, title: this.$t(`helpCenter.a_${a.key}_title`), body: this.$t(`helpCenter.a_${a.key}`).split('\n') }))
                .filter(a => !this.q || a.title.toLowerCase().includes(this.q) || a.body.some(p => p.toLowerCase().includes(this.q)))
        },
        terms(): { key: string, title: string, body: string }[] {
            return TERMS
                .map(k => ({ key: k, title: this.$t(`help.${k}_title`), body: this.$t(`help.${k}`) }))
                .filter(t => !this.q || t.title.toLowerCase().includes(this.q) || t.body.toLowerCase().includes(this.q))
        }
    }
})
</script>
<style lang="sass" scoped>
.article-body
  line-height: 1.55

.term-body
  white-space: normal
  line-height: 1.45
</style>
