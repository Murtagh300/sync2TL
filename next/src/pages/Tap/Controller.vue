<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('tap.title')" />
        <page-content
            class="col"
            padding
        >
            <div
                v-if="error"
                class="text-center q-py-xl"
            >
                <q-icon
                    name="o_error_outline"
                    size="48px"
                    class="text-muted"
                />
                <p class="q-mt-md text-soft">{{error}}</p>
            </div>
            <q-skeleton
                v-else-if="!info"
                height="180px"
            />
            <div
                v-else
                class="column items-center text-center q-mt-md"
            >
                <q-icon
                    name="o_storefront"
                    size="44px"
                    color="primary"
                />
                <div class="text-muted q-mt-sm">{{$t('tap.label_shop')}} <address-label :addr="info.address" /></div>
                <template v-if="info.sale">
                    <div class="bvm-display due q-mt-md">{{info.sale.amount}} {{info.sale.symbol}}</div>
                    <p class="text-soft q-mt-sm hint">{{$t('tap.msg_due')}}</p>
                </template>
                <template v-else>
                    <div class="row items-center no-wrap q-mt-lg text-muted">
                        <bv-loader
                            size="20px"
                            class="q-mr-sm"
                        />{{$t('tap.msg_waiting')}}
                    </div>
                    <p class="text-caption text-muted q-mt-sm hint">{{$t('tap.msg_waiting_hint')}}</p>
                </template>
            </div>
        </page-content>
        <page-action v-if="info">
            <q-btn
                unelevated
                no-caps
                size="lg"
                color="primary"
                :label="info.sale ? $t('tap.action_pay') : $t('tap.action_pay_other')"
                @click="pay()"
            />
        </page-action>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import PageToolbar from 'components/PageToolbar.vue'
import PageContent from 'components/PageContent.vue'
import PageAction from 'components/PageAction.vue'
import AddressLabel from 'components/AddressLabel.vue'
import { readTap, type TapInfo } from 'src/utils/till-tap'

// what a tap on a shop's NFC sticker opens: the sale the till has open, to pay with the send form
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel },
    data: () => ({
        info: null as TapInfo | null,
        error: '',
        poll: null as ReturnType<typeof setInterval> | null
    }),
    async created() {
        await this.load()
        // tapped before the till rang it up: it shows up here
        this.poll = setInterval(() => { if (!this.info?.sale) void this.load() }, 3000)
    },
    beforeUnmount() {
        this.poll && clearInterval(this.poll)
    },
    methods: {
        async load() {
            try {
                this.info = await readTap(String(this.$route.params.id || ''))
                this.error = ''
            } catch {
                if (!this.info) this.error = this.$t('tap.msg_unknown')
            }
        },
        pay() {
            const i = this.info
            if (!i) return
            const query: Record<string, string> = { to: i.address }
            if (i.sale) {
                query.amount = i.sale.amount
                query.symbol = i.sale.symbol
            }
            void this.$router.push({ name: 'send', query })
        }
    }
})
</script>
<style lang="sass" scoped>
.due
  font-size: 36px

.hint
  max-width: 320px
</style>
