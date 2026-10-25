<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('search.title')" />
        <div class="q-px-md q-pt-md">
            <q-input
                v-model="query"
                outlined
                autofocus
                clearable
                :placeholder="$t('search.placeholder')"
                debounce="200"
            >
                <template #prepend>
                    <q-icon name="o_search" />
                </template>
            </q-input>
        </div>
        <page-content
            class="col"
            padding
        >
            <template v-if="q">
                <!-- a .vet name or an address: send to it -->
                <div
                    v-if="resolved || isAddress"
                    class="bvm-tile q-pa-md q-mb-md row no-wrap items-center"
                >
                    <address-avatar
                        :addr="resolved || q"
                        size="36px"
                    />
                    <div
                        class="col q-ml-md"
                        style="min-width: 0"
                    >
                        <div class="text-weight-bold ellipsis">{{resolvedName || q}}</div>
                        <address-label
                            no-icon
                            class="text-muted"
                            :addr="resolved || q"
                            no-name
                        />
                    </div>
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        icon="o_north_east"
                        :label="$t('send.action_send')"
                        :to="{ name: 'send', query: { to: resolved || q } }"
                    />
                </div>

                <section v-if="contacts.length">
                    <div class="bvm-label q-mb-sm q-ml-xs">{{$t('contacts.title')}}</div>
                    <q-list class="bvm-list q-mb-md">
                        <q-item
                            v-for="c in contacts"
                            :key="c.address"
                            clickable
                            :to="{ name: 'send', query: { to: c.address } }"
                        >
                            <q-item-section avatar>
                                <address-avatar
                                    :addr="c.address"
                                    size="32px"
                                />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>{{c.name}}</q-item-label>
                                <q-item-label caption>
                                    <address-label
                                        no-icon
                                        :addr="c.address"
                                        no-name
                                    />
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </section>

                <section v-if="tokens.length">
                    <div class="bvm-label q-mb-sm q-ml-xs">{{$t('search.label_tokens')}}</div>
                    <q-list class="bvm-list q-mb-md">
                        <q-item
                            v-for="t in tokens"
                            :key="t.symbol"
                            clickable
                            :to="wallet ? { name: 'asset', params: { walletId: String(wallet.id), addressIndex: '0', symbol: t.symbol } } : undefined"
                        >
                            <q-item-section avatar>
                                <token-avatar
                                    :spec="t"
                                    size="32px"
                                />
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>{{t.symbol}}</q-item-label>
                                <q-item-label caption>{{t.name}}</q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </section>

                <section v-if="collections.length">
                    <div class="bvm-label q-mb-sm q-ml-xs">{{$t('search.label_collections')}}</div>
                    <q-list class="bvm-list q-mb-md">
                        <q-item
                            v-for="c in collections"
                            :key="c.slug"
                            clickable
                            :to="{ name: 'collection', params: { slug: c.slug } }"
                        >
                            <q-item-section avatar>
                                <q-avatar rounded>
                                    <img
                                        :src="c.coverImage"
                                        loading="lazy"
                                    >
                                </q-avatar>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>{{c.name}}</q-item-label>
                                <q-item-label
                                    v-if="c.floorValue"
                                    caption
                                >{{$t('market.label_floor')}} {{c.floorValue}} {{c.floorCurrency}}</q-item-label>
                            </q-item-section>
                            <q-item-section side>
                                <q-icon
                                    name="chevron_right"
                                    size="18px"
                                />
                            </q-item-section>
                        </q-item>
                    </q-list>
                </section>

                <div
                    v-if="!contacts.length && !tokens.length && !collections.length && !resolved && !isAddress && !resolving"
                    class="text-center text-soft q-pa-lg"
                >{{$t('search.msg_nothing', { q })}}</div>
            </template>
            <div
                v-else
                class="text-center text-soft q-pa-lg"
            >{{$t('search.msg_hint')}}</div>
        </page-content>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { address } from 'thor-devkit'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import AddressAvatar from 'components/AddressAvatar.vue'
import AddressLabel from 'components/AddressLabel.vue'
import TokenAvatar from 'components/TokenAvatar.vue'
import { isVetName, resolveVetName, type Contact } from 'src/utils/names'
import { selectedWallet } from 'src/utils/selection'
import { openURL } from 'src/utils/open-url'
import type { BVM } from 'boot/services/bvm'

// one search over contacts, tokens, collections, .vet names and addresses
export default defineComponent({
    components: { PageToolbar, PageContent, AddressAvatar, AddressLabel, TokenAvatar },
    data: () => ({
        query: '' as string | null,
        resolved: '',
        resolvedName: '',
        resolving: false,
        allContacts: [] as Contact[],
        allTokens: [] as M.TokenSpec[],
        allCollections: [] as BVM.Collection[],
        wallets: [] as M.Wallet[]
    }),
    computed: {
        q(): string {
            return (this.query || '').trim()
        },
        lower(): string {
            return this.q.toLowerCase()
        },
        wallet(): M.Wallet | null {
            return selectedWallet(this.wallets)
        },
        isAddress(): boolean {
            return address.test(this.q)
        },
        contacts(): Contact[] {
            return this.allContacts.filter(c => c.name.toLowerCase().includes(this.lower) || c.address.toLowerCase().includes(this.lower)).slice(0, 6)
        },
        tokens(): M.TokenSpec[] {
            const gid = this.wallet?.gid
            return this.allTokens
                .filter(t => (!gid || t.gid === gid) && (t.symbol.toLowerCase().includes(this.lower) || t.name.toLowerCase().includes(this.lower)))
                .slice(0, 8)
        },
        collections(): BVM.Collection[] {
            return this.allCollections.filter(c => c.name.toLowerCase().includes(this.lower)).slice(0, 8)
        }
    },
    watch: {
        async q(v: string) {
            this.resolved = ''
            this.resolvedName = ''
            if (isVetName(v)) {
                this.resolving = true
                try {
                    const a = await resolveVetName(v)
                    if (this.q === v && a) {
                        this.resolved = a
                        this.resolvedName = v.toLowerCase()
                    }
                } catch { } finally {
                    this.resolving = false
                }
            }
        }
    },
    async created() {
        const [contacts, tokens, wallets] = await Promise.all([
            this.$svc.config.getContacts(),
            this.$svc.config.token.all(),
            this.$svc.wallet.all()
        ])
        this.allContacts = contacts
        this.allTokens = tokens
        this.wallets = wallets
        this.$svc.bvm.collections()
            .then(c => { this.allCollections = Object.values(c).sort((a, b) => a.name.localeCompare(b.name)) })
            .catch(() => { })
    },
    methods: {
        openURL
    }
})
</script>
