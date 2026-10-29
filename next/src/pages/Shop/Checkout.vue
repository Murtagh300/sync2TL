<template>
    <div class="fit column no-wrap">
        <page-toolbar :title="$t('shop.title_checkout')" />
        <page-content
            class="col"
            padding
        >
            <div
                v-if="error"
                class="text-center q-py-xl text-soft"
            >{{error}}</div>
            <q-skeleton
                v-else-if="!order"
                height="200px"
            />
            <div
                v-else
                class="column items-center text-center q-mt-md"
            >
                <q-icon
                    :name="order.status === 'paid' ? 'check_circle' : 'o_shopping_bag'"
                    size="56px"
                    :color="order.status === 'expired' ? 'grey-6' : 'primary'"
                />
                <div class="text-muted q-mt-sm">{{order.shopName}}</div>
                <div class="bvm-display due q-mt-sm">{{order.amount}} {{order.symbol}}</div>
                <div class="text-soft">{{money(order.fiat, order.currency)}}</div>
                <template v-if="order.status === 'pending'">
                    <p class="text-soft q-mt-md hint">{{$t('shop.msg_exact')}}</p>
                    <div class="text-caption text-muted">{{$t('shop.label_to')}} <address-label :addr="order.address" /></div>
                    <div class="text-caption text-muted q-mt-xs">{{$t('shop.label_valid', { when: until })}}</div>
                    <div
                        v-if="paying"
                        class="row items-center no-wrap q-mt-md text-muted"
                    >
                        <q-spinner-dots
                            size="20px"
                            class="q-mr-sm"
                        />{{$t('shop.msg_waiting')}}
                    </div>
                </template>
                <div
                    v-else-if="order.status === 'paid'"
                    class="text-primary text-weight-bold q-mt-md"
                >{{$t('shop.msg_paid')}}</div>
                <div
                    v-else
                    class="text-soft q-mt-md"
                >{{$t('shop.msg_expired')}}</div>
            </div>
        </page-content>
        <page-action v-if="order">
            <q-btn
                v-if="order.status === 'pending'"
                unelevated
                no-caps
                size="lg"
                color="primary"
                :label="$t('shop.action_pay')"
                @click="pay()"
            />
            <q-btn
                v-else-if="order.returnUrl"
                unelevated
                no-caps
                size="lg"
                color="primary"
                icon="o_storefront"
                :label="$t('shop.action_back')"
                @click="back()"
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
import { formatDate, numberLocale } from 'src/utils/format'
import { openURL } from 'src/utils/open-url'
import { readCheckout, type Checkout } from 'src/utils/shop'

// a web shop's order: pay it with the send form, then back to the shop
export default defineComponent({
    components: { PageToolbar, PageContent, PageAction, AddressLabel },
    data: () => ({
        order: null as Checkout | null,
        error: '',
        paying: false,
        poll: null as ReturnType<typeof setInterval> | null
    }),
    computed: {
        until(): string {
            return this.order ? formatDate(this.order.expiresAt, { relative: true }) : ''
        }
    },
    async created() {
        await this.load()
        this.poll = setInterval(() => { if (this.order?.status === 'pending') void this.load() }, 5000)
    },
    beforeUnmount() {
        this.poll && clearInterval(this.poll)
    },
    methods: {
        money(n: number, currency: string) {
            return new Intl.NumberFormat(numberLocale(), { style: 'currency', currency }).format(n)
        },
        async load() {
            try {
                this.order = await readCheckout(String(this.$route.params.token || ''))
                this.error = ''
            } catch {
                if (!this.order) this.error = this.$t('shop.msg_unknown')
            }
        },
        pay() {
            const o = this.order
            if (!o) return
            this.paying = true
            void this.$router.push({ name: 'send', query: { to: o.address, amount: o.amount, symbol: o.symbol } })
        },
        back() {
            const url = this.order?.returnUrl || ''
            if (/^https:\/\//.test(url)) openURL(url)
        }
    }
})
</script>
<style lang="sass" scoped>
.due
  font-size: 34px

.hint
  max-width: 320px
</style>
