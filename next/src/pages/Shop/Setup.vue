<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('shop.title')" />
        <page-content
            class="col"
            padding
        >
            <p class="text-soft">{{$t('shop.msg_intro')}}</p>
            <empty-state
                v-if="!available"
                icon="o_cloud_off"
                :text="$t('chat.msg_no_server')"
            />
            <template v-else>
                <div
                    v-for="s in shops"
                    :key="s.id"
                    class="bvm-tile q-pa-md q-mb-md"
                >
                    <div class="row no-wrap items-center">
                        <div class="col text-weight-bold">{{s.name}}</div>
                        <q-btn
                            flat
                            round
                            dense
                            icon="o_delete_outline"
                            :aria-label="$t('common.delete')"
                            @click="forget(s)"
                        />
                    </div>
                    <div class="text-caption text-muted q-mb-sm"><address-label :addr="s.address" /></div>
                    <div
                        v-for="f in fields(s)"
                        :key="f.label"
                        class="row no-wrap items-center field"
                    >
                        <div class="text-muted field-label">{{f.label}}</div>
                        <code class="col ellipsis">{{f.secret && !shown[s.id] ? '••••••••••••' : f.value}}</code>
                        <q-btn
                            v-if="f.secret"
                            flat
                            round
                            dense
                            size="sm"
                            :icon="shown[s.id] ? 'o_visibility_off' : 'o_visibility'"
                            :aria-label="$t('shop.action_show_key')"
                            @click="shown = { ...shown, [s.id]: !shown[s.id] }"
                        />
                        <q-btn
                            flat
                            round
                            dense
                            size="sm"
                            icon="o_content_copy"
                            :aria-label="$t('common.copy')"
                            @click="copy(f.value)"
                        />
                    </div>
                </div>

                <div class="bvm-tile q-pa-md q-mb-md">
                    <div class="text-weight-bold q-mb-sm">{{$t('shop.title_new')}}</div>
                    <q-input
                        v-model="name"
                        outlined
                        dense
                        maxlength="60"
                        :label="$t('shop.label_name')"
                        class="q-mb-sm"
                    />
                    <q-select
                        v-if="addresses.length > 1"
                        v-model="address"
                        :options="addresses"
                        emit-value
                        map-options
                        outlined
                        dense
                        :label="$t('invoice.label_paid_to')"
                        class="q-mb-sm"
                    />
                    <q-btn
                        unelevated
                        no-caps
                        color="primary"
                        class="full-width"
                        :loading="working"
                        :disable="!name.trim() || !address"
                        :label="$t('shop.action_create')"
                        @click="create()"
                    />
                </div>

                <div class="text-weight-bold q-mb-xs">{{$t('shop.title_woo')}}</div>
                <ol class="steps text-soft">
                    <li>{{$t('shop.step_download')}} <a
                        :href="pluginUrl"
                        download
                        class="text-primary"
                    >blackvault-pay.php</a></li>
                    <li>{{$t('shop.step_upload')}}</li>
                    <li>{{$t('shop.step_settings')}}</li>
                </ol>
                <p class="text-caption text-muted">{{$t('shop.msg_api')}}</p>
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
import { genesises } from 'src/consts'
import { selectedWallet } from 'src/utils/selection'
import { copyText } from 'src/utils/clipboard'
import { apiBase, createShop, forgetShop, myShops, shopAvailable, type Shop } from 'src/utils/shop'

// a web shop that takes VET and B3TR: its id and key for the shop's plugin
export default defineComponent({
    components: { PageToolbar, PageContent, EmptyState, AddressLabel },
    data: () => ({
        available: shopAvailable(),
        wallets: [] as M.Wallet[],
        shops: myShops(),
        name: '',
        address: '',
        working: false,
        shown: {} as Record<string, boolean>
    }),
    computed: {
        addresses(): { label: string, value: string }[] {
            return this.wallets.filter(w => w.gid === genesises.main.id)
                .flatMap(w => w.meta.addresses.map((a, k) => ({ label: `${w.meta.name} #${k + 1} · ${a.slice(0, 6)}…${a.slice(-4)}`, value: a })))
        },
        pluginUrl(): string {
            return new URL('integrations/woocommerce/blackvault-pay.php', window.location.origin + window.location.pathname).href
        }
    },
    async created() {
        this.wallets = await this.$svc.wallet.all()
        const w = selectedWallet(this.wallets.filter(x => x.gid === genesises.main.id))
        this.address = w?.meta.addresses[0] || this.addresses[0]?.value || ''
    },
    methods: {
        fields(s: Shop) {
            return [
                { label: this.$t('shop.label_api'), value: apiBase(), secret: false },
                { label: this.$t('shop.label_id'), value: s.id, secret: false },
                { label: this.$t('shop.label_key'), value: s.key, secret: true }
            ]
        },
        async create() {
            this.working = true
            try {
                const s = await createShop(this.address, this.name)
                this.shops = myShops()
                this.shown = { ...this.shown, [s.id]: true }
                this.name = ''
            } catch (err) {
                console.warn('shop:', err)
                this.$q.notify(this.$t('common.something_wrong'))
            } finally {
                this.working = false
            }
        },
        forget(s: Shop) {
            this.$q.dialog({
                title: this.$t('shop.title_forget'),
                message: this.$t('shop.msg_forget'),
                cancel: true,
                ok: { label: this.$t('common.delete'), color: 'negative', unelevated: true, noCaps: true }
            }).onOk(() => {
                forgetShop(s.id)
                this.shops = myShops()
            })
        },
        async copy(v: string) {
            await copyText(v)
            this.$q.notify(this.$t('common.copied'))
        }
    }
})
</script>
<style lang="sass" scoped>
.field
  gap: 6px
  min-height: 32px

.field-label
  width: 64px
  font-size: 12px

.steps
  padding-left: 20px
  line-height: 1.7
</style>
